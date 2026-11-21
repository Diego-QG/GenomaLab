import { useMemo, useState } from 'react'
import type { RespuestaGrafo } from '@compartido/contrato'
import { Kmer } from '@/componentes/Base'
import { LeyendaDeEscala, MapaDeCalor, type CeldaSenalada } from '@/componentes/graficos/MapaDeCalor'
import { Cabecera, Cargando, Dato, ErrorDelMotorVisible, Segmentos } from '@/componentes/ui'
import { useApp } from '@/estado/app'
import { RAMPA_FLUOR, escalaFluor } from '@/lib/colores'
import { decimal, entero } from '@/lib/formato'
import { useMotor } from '@/motor/cliente'
import { Construccion } from './Construccion'
import { Red } from './Red'

type Vista = 'construccion' | 'resultado'

const PAREJAS_DE_EJEMPLO = 8

function Resultado({ grafo }: { grafo: RespuestaGrafo }) {
  const [senalada, setSenalada] = useState<CeldaSenalada | null>(null)
  const [cuantos, setCuantos] = useState(48)

  const { maximo, noNulos } = useMemo(() => {
    let tope = 0
    let cantidad = 0
    for (const fila of grafo.matriz) {
      for (const valor of fila) {
        if (valor > tope) tope = valor
        if (valor > 0) cantidad++
      }
    }
    return { maximo: tope, noNulos: cantidad }
  }, [grafo])
  const escala = useMemo(() => escalaFluor(maximo), [maximo])
  const valorSenalado = senalada ? (grafo.matriz[senalada.fila]?.[senalada.columna] ?? 0) : 0

  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-10 overflow-y-auto px-6 pb-5">
      <section className="flex min-w-0 flex-col">
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm">Matriz de pesos, 16 × 16</h2>
            <p className="mt-0.5 text-xs text-tinta-3">Fila = pareja de origen, columna = pareja de destino.</p>
          </div>
          <LeyendaDeEscala colores={RAMPA_FLUOR} minimo="0" maximo={decimal(maximo, 1)} />
        </div>
        <div className="mx-auto w-full max-w-[min(27rem,calc(100vh-24.5rem))]">
          <MapaDeCalor
            matriz={grafo.matriz}
            nombres={grafo.nombres}
            color={escala}
            senalada={senalada}
            alSenalar={setSenalada}
            describir={(f, c, v) => `${grafo.nombres[f]} → ${grafo.nombres[c]}: ${decimal(v, 2)}`}
            etiquetaAccesible="Mapa de calor de la matriz del grafo"
          />
        </div>
        <div className="mt-3 flex h-9 items-center justify-center gap-2.5 text-sm" id="lectura-grafo" aria-live="off">
          {senalada ? (
            <>
              <Kmer texto={grafo.nombres[senalada.fila]} tamano="m" />
              <span className="text-tinta-3">→</span>
              <Kmer texto={grafo.nombres[senalada.columna]} tamano="m" />
              <span className="mono cifras text-lg font-bold text-tinta">{decimal(valorSenalado, 2)}</span>
            </>
          ) : (
            <span className="text-xs text-tinta-3">Pasa el cursor por una celda o por una flecha para leer su peso.</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-9 gap-y-2 border-t border-linea pt-3">
          <Dato etiqueta="Parejas en la secuencia">{entero(grafo.parejas)}</Dato>
          <Dato etiqueta="Parejas ambiguas" titulo="Parejas con alguna base ambigua: no generan arcos">
            {entero(grafo.parejasInvalidas)}
          </Dato>
          <Dato etiqueta="Arcos distintos" titulo="Celdas de la matriz con peso mayor que cero">
            {entero(noNulos)} <span className="text-sm font-normal text-tinta-3">de 256</span>
          </Dato>
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-col">
        <div className="mb-1 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm">El mismo grafo como red</h2>
            <p className="mt-0.5 text-xs text-tinta-3">Flecha más gruesa = arco más pesado. Pasa el cursor por una pareja para ver a dónde apunta.</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-tinta-3">
            Arcos
            <input
              type="range"
              min={8}
              max={Math.max(8, noNulos)}
              value={Math.min(cuantos, Math.max(8, noNulos))}
              onChange={(e) => setCuantos(Number(e.target.value))}
              className="w-28 accent-[var(--color-hueso)]"
              aria-label="Cuántos arcos dibujar, empezando por los más pesados"
            />
            <span className="mono cifras w-7 text-right text-tinta-2">{Math.min(cuantos, noNulos)}</span>
          </label>
        </div>
        <div className="mx-auto min-h-0 w-full max-w-[min(30rem,calc(100vh-17rem))] flex-1">
          <Red matriz={grafo.matriz} nombres={grafo.nombres} senalada={senalada} alSenalar={setSenalada} cuantos={cuantos} />
        </div>
      </section>
    </div>
  )
}

/**
 * Pantalla 7 — Grafo de parejas (Khan et al., 2024): cómo se construye, la
 * matriz 16 × 16 como mapa de calor y la red de 16 nodos.
 */
export function Grafo() {
  const id = useApp((s) => s.virusActual)
  const [vista, setVista] = useState<Vista>('construccion')
  const grafo = useMotor('grafo', id ? [id, String(PAREJAS_DE_EJEMPLO)] : null)
  const virus = useMotor('virus', id ? [id] : null)

  if (!id) return <div className="grid h-full place-items-center text-tinta-3">Elige un virus en el Explorador.</div>

  const error = grafo.error ?? virus.error
  return (
    <div className="flex h-full flex-col">
      <Cabecera
        titulo="Grafo de parejas"
        descripcion="La secuencia se corta en parejas de bases; cada pareja apunta a todas las posteriores con peso 1 / distancia. Sumando los arcos repetidos queda una matriz de 16 × 16."
      >
        <Segmentos
          etiqueta="Vista"
          valor={vista}
          alCambiar={setVista}
          opciones={[
            { valor: 'construccion', etiqueta: 'Cómo se construye' },
            { valor: 'resultado', etiqueta: 'Matriz y red' },
          ]}
        />
      </Cabecera>

      <div className="min-h-0 flex-1">
        {error ? (
          <ErrorDelMotorVisible
            error={error}
            alReintentar={() => {
              grafo.recargar()
              virus.recargar()
            }}
          />
        ) : !grafo.datos || !virus.datos ? (
          <Cargando texto="El motor está construyendo el grafo…" />
        ) : vista === 'construccion' ? (
          <Construccion key={id} grafo={grafo.datos} secuencia={virus.datos.secuencia} parejasDeEjemplo={PAREJAS_DE_EJEMPLO} />
        ) : (
          <Resultado key={id} grafo={grafo.datos} />
        )}
      </div>
    </div>
  )
}
