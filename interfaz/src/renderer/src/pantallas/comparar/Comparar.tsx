import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Kmer } from '@/componentes/Base'
import { LeyendaDeEscala, MapaDeCalor, type CeldaSenalada } from '@/componentes/graficos/MapaDeCalor'
import { SelectorVirus } from '@/componentes/SelectorVirus'
import { Cabecera, Cargando, ErrorDelMotorVisible } from '@/componentes/ui'
import { useApp } from '@/estado/app'
import { NEUTRO_DIFERENCIA, POLO_CALIDO, POLO_FRIO, RAMPA_FLUOR, colorDeGrupo, escalaDivergente, escalaFluor } from '@/lib/colores'
import { decimal } from '@/lib/formato'
import { useMotor } from '@/motor/cliente'
import { Medidor } from './Medidor'

/** Cada mapa es cuadrado: su ancho se limita según el alto libre de la ventana para que quepan sin desplazarse. */
const CAJA_DE_MAPA = 'mx-auto w-full min-w-0 max-w-[calc(100vh-25.5rem)]'

function maximoDe(matriz: readonly (readonly number[])[], absoluto = false): number {
  let tope = 0
  for (const fila of matriz) for (const v of fila) tope = Math.max(tope, absoluto ? Math.abs(v) : v)
  return tope
}

function conSigno(valor: number): string {
  return `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${decimal(Math.abs(valor), 2)}`
}

function TituloDeMapa({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <h2 className="flex min-w-0 items-center gap-2 text-sm">
      {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{children}</span>
    </h2>
  )
}

/**
 * Pantalla 8 — Comparar dos virus: similitudes (k-mers con k = 3 y k = 6, y grafo)
 * y las dos matrices de parejas con su mapa de diferencias.
 */
export function Comparar() {
  const resumen = useApp((s) => s.resumen)
  const idA = useApp((s) => s.virusActual)
  const idB = useApp((s) => s.virusComparado)
  const elegirVirus = useApp((s) => s.elegirVirus)
  const elegirComparado = useApp((s) => s.elegirComparado)
  const [senalada, setSenalada] = useState<CeldaSenalada | null>(null)

  const par = idA !== null && idB !== null && idA !== idB ? { a: idA, b: idB } : null
  const listos = par !== null
  const comparacion = useMotor('comparar', par ? [par.a, par.b] : null)
  const grafoA = useMotor('grafo', par ? [par.a] : null)
  const grafoB = useMotor('grafo', par ? [par.b] : null)

  const escalas = useMemo(() => {
    if (!grafoA.datos || !grafoB.datos || !comparacion.datos) return null
    // Las dos matrices comparten escala para que los colores se puedan comparar
    const tope = Math.max(maximoDe(grafoA.datos.matriz), maximoDe(grafoB.datos.matriz))
    const topeDiferencia = maximoDe(comparacion.datos.diferenciaGrafo, true)
    return { tope, topeDiferencia, calor: escalaFluor(tope), diferencia: escalaDivergente(topeDiferencia) }
  }, [grafoA.datos, grafoB.datos, comparacion.datos])

  if (!resumen) return null

  const virusA = resumen.virus.find((v) => v.id === idA)
  const virusB = resumen.virus.find((v) => v.id === idB)
  const intercambiar = (): void => {
    if (!idA || !idB) return
    useApp.setState({ virusActual: idB, virusComparado: idA })
  }

  const error = comparacion.error ?? grafoA.error ?? grafoB.error
  let escena: ReactNode
  if (!listos) {
    escena = <div className="grid h-full place-items-center text-tinta-3">Elige dos virus distintos para compararlos.</div>
  } else if (error) {
    escena = (
      <ErrorDelMotorVisible
        error={error}
        alReintentar={() => {
          comparacion.recargar()
          grafoA.recargar()
          grafoB.recargar()
        }}
      />
    )
  } else if (!comparacion.datos || !grafoA.datos || !grafoB.datos || !escalas) {
    escena = <Cargando texto="El motor está comparando los dos virus…" />
  } else {
    const c = comparacion.datos
    const nombres = grafoA.datos.nombres
    const describir =
      (matriz: readonly (readonly number[])[], quien: string) =>
      (f: number, col: number, v: number): string =>
        `${quien} · ${nombres[f]} → ${nombres[col]}: ${decimal(matriz[f]?.[col] ?? v, 2)}`
    const a = senalada ? (grafoA.datos.matriz[senalada.fila]?.[senalada.columna] ?? 0) : 0
    const b = senalada ? (grafoB.datos.matriz[senalada.fila]?.[senalada.columna] ?? 0) : 0
    const d = senalada ? (c.diferenciaGrafo[senalada.fila]?.[senalada.columna] ?? 0) : 0

    escena = (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-4">
        <section className="grid shrink-0 grid-cols-3 gap-6 rounded-xl border border-linea bg-superficie px-5 py-3" aria-label="Similitudes">
          <Medidor key={`3:${c.id1}:${c.id2}`} titulo="K-mers, k = 3" detalle="Coseno entre los vectores de 64 conteos." valor={c.simKmers3} />
          <Medidor key={`6:${c.id1}:${c.id2}`} titulo="K-mers, k = 6" detalle="Coseno entre los vectores de 4096 conteos." valor={c.simKmers6} />
          <Medidor key={`g:${c.id1}:${c.id2}`} titulo="Grafo de parejas" detalle="Coseno entre las dos matrices de 16 × 16." valor={c.simGrafo} />
        </section>

        <section className="grid shrink-0 grid-cols-3 gap-7">
          <div className={CAJA_DE_MAPA}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <TituloDeMapa color={virusA ? colorDeGrupo(virusA.grupo) : undefined}>
                <span className="mono text-xs">{c.id1}</span>
              </TituloDeMapa>
            </div>
            <MapaDeCalor
              matriz={grafoA.datos.matriz}
              nombres={nombres}
              color={escalas.calor}
              senalada={senalada}
              alSenalar={setSenalada}
              describir={describir(grafoA.datos.matriz, c.id1)}
              etiquetaAccesible={`Matriz del grafo de ${c.id1}`}
            />
          </div>
          <div className={CAJA_DE_MAPA}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <TituloDeMapa color={virusB ? colorDeGrupo(virusB.grupo) : undefined}>
                <span className="mono text-xs">{c.id2}</span>
              </TituloDeMapa>
            </div>
            <MapaDeCalor
              matriz={grafoB.datos.matriz}
              nombres={nombres}
              color={escalas.calor}
              senalada={senalada}
              alSenalar={setSenalada}
              describir={describir(grafoB.datos.matriz, c.id2)}
              etiquetaAccesible={`Matriz del grafo de ${c.id2}`}
            />
          </div>
          <div className={CAJA_DE_MAPA}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <TituloDeMapa>Diferencia (primero − segundo)</TituloDeMapa>
            </div>
            <MapaDeCalor
              matriz={c.diferenciaGrafo}
              nombres={nombres}
              color={escalas.diferencia}
              senalada={senalada}
              alSenalar={setSenalada}
              describir={(f, col, v) => `${nombres[f]} → ${nombres[col]}: ${conSigno(v)}`}
              etiquetaAccesible="Mapa de diferencias entre las dos matrices"
            />
          </div>
        </section>

        <section className="flex shrink-0 flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-linea pt-3">
          <div className="flex h-8 items-center gap-2.5 text-sm" id="lectura-comparar">
            {senalada ? (
              <>
                <Kmer texto={nombres[senalada.fila]} tamano="m" />
                <span className="text-tinta-3">→</span>
                <Kmer texto={nombres[senalada.columna]} tamano="m" />
                <span className="ml-2 text-tinta-2">
                  primero <span className="mono cifras font-bold text-tinta">{decimal(a, 2)}</span>
                </span>
                <span className="text-tinta-2">
                  segundo <span className="mono cifras font-bold text-tinta">{decimal(b, 2)}</span>
                </span>
                <span className="text-tinta-2">
                  diferencia <span className="mono cifras font-bold text-tinta">{conSigno(d)}</span>
                </span>
              </>
            ) : (
              <span className="text-xs text-tinta-3">Pasa el cursor por cualquiera de los tres mapas: la misma celda se marca en todos.</span>
            )}
          </div>
          <div className="flex items-center gap-7">
            <div className="flex items-center gap-2 text-2xs text-tinta-3">
              peso del arco
              <LeyendaDeEscala colores={RAMPA_FLUOR} minimo="0" maximo={decimal(escalas.tope, 1)} />
            </div>
            <div className="flex items-center gap-2 text-2xs text-tinta-3">
              más en el segundo
              <LeyendaDeEscala colores={[POLO_FRIO, NEUTRO_DIFERENCIA, POLO_CALIDO]} minimo={`−${decimal(escalas.topeDiferencia, 1)}`} maximo={`+${decimal(escalas.topeDiferencia, 1)}`} />
              más en el primero
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Cabecera titulo="Comparar dos virus" descripcion="El motor mide cuánto se parecen de tres formas y resta sus matrices de parejas para mostrar dónde difieren.">
        <SelectorVirus valor={idA} alElegir={elegirVirus} etiqueta="Primero" excluir={idB} alineacion="derecha" />
        <button
          type="button"
          onClick={intercambiar}
          title="Intercambiar el primero y el segundo"
          aria-label="Intercambiar el primero y el segundo"
          className="grid h-9 w-9 place-items-center rounded-md text-tinta-2 hover:bg-superficie-2 hover:text-tinta"
        >
          <ArrowLeftRight size={16} />
        </button>
        <SelectorVirus valor={idB} alElegir={elegirComparado} etiqueta="Segundo" excluir={idA} alineacion="derecha" />
      </Cabecera>
      <div className="min-h-0 flex-1">{escena}</div>
    </div>
  )
}
