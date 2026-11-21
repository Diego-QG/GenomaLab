import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Download, LoaderCircle } from 'lucide-react'
import { Boton, Cabecera, Cargando, ErrorDelMotorVisible } from '@/componentes/ui'
import { useApp } from '@/estado/app'
import { SIN_DATO, entero } from '@/lib/formato'
import { useMotor } from '@/motor/cliente'
import { PanelDeK } from './Barras'
import { exportarPng } from './exportar'
import { COLOR_METODO, METODOS, NOMBRE_METODO, armarPaneles, conDecimales, esFinito, vecesEntreKs, type PanelK } from './modelo'

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-linea bg-superficie px-4 py-3">
      <h2 className="text-xs font-normal text-tinta-3">{titulo}</h2>
      <div className="mt-1.5">{children}</div>
    </section>
  )
}

/** Tabla con los resultados de cada k: colisiones de los dos métodos y cuánto bajan con doble hashing. */
function TablaResultados({ paneles }: { paneles: PanelK[] }) {
  return (
    <section className="shrink-0 overflow-hidden rounded-xl border border-linea bg-superficie" aria-label="Resultados del experimento">
      <table className="w-full table-fixed border-collapse text-sm" id="tabla-experimentos">
        <colgroup>
          <col className="w-20" />
          <col className="w-20" />
          <col className="w-32" />
          <col />
          <col />
          <col />
          <col />
          <col className="w-36" />
        </colgroup>
        <thead>
          <tr className="text-xs text-tinta-2">
            <th colSpan={3} />
            {METODOS.map((m) => (
              <th key={m} colSpan={2} className="border-l border-linea px-4 pt-2.5 text-left font-normal">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLOR_METODO[m] }} />
                  {NOMBRE_METODO[m]}
                </span>
              </th>
            ))}
            <th className="border-l border-linea" />
          </tr>
          <tr className="border-b border-linea text-xs text-tinta-3">
            <th className="py-2 pl-4 text-left font-normal">k</th>
            <th className="py-2 pr-4 text-right font-normal" title="Virus distintos que el motor contó con este k">
              Virus
            </th>
            <th className="py-2 pr-4 text-right font-normal" title="Promedio de k-mers distintos / casillas de la tabla (igual en los dos métodos)">
              Factor de carga
            </th>
            {METODOS.map((m) => (
              <Fragment key={m}>
                <th className="border-l border-linea py-2 pr-4 text-right font-normal" title={`Suma de las colisiones de todos los virus (${NOMBRE_METODO[m].toLowerCase()})`}>
                  Colisiones totales
                </th>
                <th className="py-2 pr-4 text-right font-normal" title="Colisiones totales / número de virus">
                  Promedio por virus
                </th>
              </Fragment>
            ))}
            <th className="border-l border-linea py-2 pr-4 text-right font-normal" title="(lineal − doble) / lineal × 100, con las colisiones totales">
              Reducción
            </th>
          </tr>
        </thead>
        <tbody>
          {paneles.map((p) => (
            <tr key={p.k} className="h-11 border-b border-linea/60 last:border-b-0" data-k={p.k}>
              <td className="pl-4 font-semibold text-tinta">k = {p.k}</td>
              <td className="mono cifras pr-4 text-right text-xs text-tinta-2">{p.virus > 0 ? entero(p.virus) : SIN_DATO}</td>
              <td className="mono cifras pr-4 text-right text-xs text-tinta-2">{esFinito(p.carga) ? p.carga.toFixed(4) : SIN_DATO}</td>
              {METODOS.map((m) => (
                <Fragment key={m}>
                  <td className="mono cifras border-l border-linea pr-4 text-right text-xs text-tinta">{entero(p[m].total)}</td>
                  <td className="mono cifras pr-4 text-right text-xs text-tinta-2">{conDecimales(p[m].promedio)}</td>
                </Fragment>
              ))}
              <td
                className={`mono cifras border-l border-linea pr-4 text-right text-sm font-semibold ${!esFinito(p.reduccion) ? 'text-tinta-3' : p.reduccion >= 0 ? 'text-bien' : 'text-mal'}`}
                data-reduccion
              >
                {esFinito(p.reduccion) ? `${conDecimales(p.reduccion)} %` : SIN_DATO}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Explicacion({ paneles }: { paneles: PanelK[] }) {
  const siempreMenos = paneles.length > 0 && paneles.every((p) => esFinito(p.reduccion) && p.reduccion > 0)
  const conVirus = paneles.filter((p) => p.virus > 0)

  return (
    <aside className="row-span-2 flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto">
      <Tarjeta titulo={siempreMenos ? '¿Por qué choca menos el doble hashing?' : 'Los dos métodos'}>
        <div className="space-y-2 text-xs leading-normal text-tinta-2">
          <p>
            Si la casilla está ocupada, el <span style={{ color: COLOR_METODO.lineal }}>sondeo lineal</span> prueba la siguiente: los k-mers que
            chocan quedan pegados en <span className="text-tinta">racimos</span> y cada choque nuevo recorre el racimo entero (agrupamiento
            primario).
          </p>
          <p>
            El <span style={{ color: COLOR_METODO.doble }}>doble hashing</span> salta según un segundo hash del k-mer: los que chocan en la misma
            casilla siguen caminos distintos y no se amontonan.
          </p>
          <p className="text-tinta-3">Cada casilla ocupada que se salta es una colisión, también al volver a contar un k-mer repetido.</p>
        </div>
      </Tarjeta>

      {conVirus.length > 0 && (
        <Tarjeta titulo="Virus que chocaron menos con doble hashing">
          <ul className="space-y-1 text-xs text-tinta-2">
            {conVirus.map((p) => (
              <li key={p.k} className="flex items-baseline justify-between gap-3">
                <span>k = {p.k}</span>
                <span>
                  <span className="mono cifras font-semibold text-tinta">{entero(p.menosConDoble)}</span> de{' '}
                  <span className="mono cifras">{entero(p.virus)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </aside>
  )
}

function Leyenda({ paneles }: { paneles: PanelK[] }) {
  const virus = Math.max(0, ...paneles.map((p) => p.virus))
  const veces = vecesEntreKs(paneles)
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-2xs text-tinta-3" style={{ gridColumn: `1 / span ${paneles.length}` }}>
      <span className="flex items-center gap-1.5">
        <span className="flex gap-px">
          <span className="h-2.5 w-1.5" style={{ background: COLOR_METODO.lineal }} />
          <span className="h-2.5 w-1.5" style={{ background: COLOR_METODO.doble }} />
        </span>
        barra: promedio de colisiones por virus
      </span>
      {virus > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-tinta-2 opacity-80" />
          punto: cada uno de los {entero(virus)} virus
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[2px] border border-dashed" style={{ borderColor: COLOR_METODO.lineal }} />
        punteado: hasta dónde llegaba el sondeo lineal
      </span>
      {esFinito(veces) && veces > 1 && paneles.length >= 2 && (
        <span>
          Cada panel tiene su propia escala: con k = {paneles[0].k} el sondeo lineal choca{' '}
          <span className="mono cifras text-tinta-2">{veces.toFixed(1)}</span> veces más que con k = {paneles[paneles.length - 1].k}.
        </span>
      )}
    </div>
  )
}

function Resultado({ paneles }: { paneles: PanelK[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 pb-4">
      <TablaResultados paneles={paneles} />
      <div
        className="grid min-h-0 flex-1 gap-x-4 gap-y-2"
        style={{ gridTemplateColumns: `repeat(${paneles.length}, minmax(0, 1fr)) 18rem`, gridTemplateRows: 'minmax(0, 1fr) auto' }}
      >
        {paneles.map((p) => (
          <PanelDeK key={p.k} panel={p} />
        ))}
        <Explicacion paneles={paneles} />
        <Leyenda paneles={paneles} />
      </div>
    </div>
  )
}

/**
 * Pantalla 11 — Experimentos: el motor cuenta los k-mers de cada virus con
 * sondeo lineal y con doble hashing, para k = 3 y k = 6 (comando `experimento`),
 * y aquí se comparan las colisiones de los dos métodos.
 */
export function Experimentos() {
  const consulta = useMotor('experimento', [])
  const archivo = useApp((s) => s.motor?.fasta?.nombre ?? null)
  const [exportando, setExportando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const paneles = useMemo(() => (consulta.datos ? armarPaneles(consulta.datos) : null), [consulta.datos])

  const exportar = async (): Promise<void> => {
    if (!paneles || paneles.length === 0) return
    setExportando(true)
    setFallo(null)
    try {
      await exportarPng({ paneles, archivo })
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e))
    } finally {
      setExportando(false)
    }
  }

  let escena: ReactNode
  if (consulta.error) {
    escena = <ErrorDelMotorVisible error={consulta.error} alReintentar={consulta.recargar} />
  } else if (consulta.cargando || !paneles) {
    escena = <Cargando texto="El motor está contando los k-mers de cada virus con los dos métodos…" />
  } else if (paneles.length === 0) {
    escena = <div className="grid h-full place-items-center text-tinta-3">El motor no devolvió resultados para el experimento.</div>
  } else {
    escena = <Resultado paneles={paneles} />
  }

  return (
    <div className="flex h-full flex-col">
      <Cabecera
        titulo="Experimentos"
        descripcion={
          <>
            El motor cuenta los k-mers de cada virus con sondeo lineal y con doble hashing (tablas de 4<sup>k</sup> casillas) y suma las
            colisiones de cada método (comando experimento).
          </>
        }
      >
        {fallo && (
          <span className="max-w-64 truncate text-xs text-mal" role="alert" title={fallo}>
            {fallo}
          </span>
        )}
        <Boton
          onClick={() => void exportar()}
          disabled={!paneles || paneles.length === 0 || exportando}
          icono={exportando ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
          title="Guardar la tabla y el gráfico como imagen PNG"
        >
          Exportar PNG
        </Boton>
      </Cabecera>
      <div className="min-h-0 flex-1">{escena}</div>
    </div>
  )
}
