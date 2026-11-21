import { useMemo, useState } from 'react'
import type { RespuestaKmers } from '@compartido/contrato'
import { Kmer } from '@/componentes/Base'
import { BarrasTop } from '@/componentes/graficos/BarrasTop'
import { Dato } from '@/componentes/ui'
import { RAMPA_FLUOR } from '@/lib/colores'
import { decimal, entero } from '@/lib/formato'
import { COLOR_DOBLE, COLOR_LINEAL } from './Insercion'
import { TablaChica, TablaGrande } from './Tablas'

function BarraDeColisiones({ nombre, valor, maximo, color }: { nombre: string; valor: number; maximo: number; color: string }) {
  return (
    <div className="flex items-center gap-3" title={`${nombre}: ${entero(valor)} colisiones`}>
      <span className="flex w-28 shrink-0 items-center gap-2 text-xs text-tinta-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {nombre}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="h-3.5 rounded-r-[4px]" style={{ width: `${maximo > 0 ? (valor / maximo) * 78 : 0}%`, background: color, minWidth: valor > 0 ? 2 : 0 }} />
        <span className="mono cifras text-xs text-tinta">{entero(valor)}</span>
      </div>
    </div>
  )
}

/**
 * Estado final de la tabla de k-mers (comando `kmers`): rejilla de calor con
 * los conteos, comparación de colisiones entre métodos y el top n.
 */
export function TablaFinal({ datos }: { datos: RespuestaKmers }) {
  const [senalada, setSenalada] = useState<number | null>(null)

  const { kmers, conteos, maximo } = useMemo(() => {
    const k: (string | null)[] = new Array<string | null>(datos.tamanoTabla).fill(null)
    const c = new Int32Array(datos.tamanoTabla)
    let m = 0
    for (const casilla of datos.casillas) {
      k[casilla.pos] = casilla.kmer
      c[casilla.pos] = casilla.conteo
      if (casilla.conteo > m) m = casilla.conteo
    }
    return { kmers: k, conteos: c, maximo: m }
  }, [datos])

  const { lineal, doble } = datos.colisiones
  const mayor = Math.max(lineal, doble)
  const chica = datos.tamanoTabla <= 64

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_21rem] gap-8 overflow-y-auto px-6 pb-5">
      <section className="min-w-0">
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm">La tabla al terminar de contar</h2>
            <p className="mt-0.5 text-xs text-tinta-3">
              {entero(datos.tamanoTabla)} casillas (4<sup>{datos.k}</sup>), llenada con doble hashing. Más claro = el k-mer aparece más veces.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-2xs text-tinta-3" aria-hidden>
            <span className="mono cifras">1</span>
            <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(to right, ${RAMPA_FLUOR.slice(1).join(', ')})` }} />
            <span className="mono cifras">{entero(maximo)}</span>
          </div>
        </div>

        {chica ? (
          <TablaChica tamano={datos.tamanoTabla} columnas={datos.tamanoTabla <= 16 ? datos.tamanoTabla : 16} kmers={kmers} conteos={conteos} calor />
        ) : (
          <>
            <TablaGrande tamano={datos.tamanoTabla} columnas={128} kmers={kmers} conteos={conteos} alSenalar={setSenalada} />
            <p className="mt-2 flex h-6 items-center gap-2 text-xs text-tinta-2">
              {senalada === null ? (
                <span className="text-tinta-3">Pasa el cursor por la tabla para ver qué hay en cada casilla.</span>
              ) : kmers[senalada] === null ? (
                <span>
                  casilla <span className="mono cifras text-tinta">{entero(senalada)}</span>: libre
                </span>
              ) : (
                <>
                  <span>
                    casilla <span className="mono cifras text-tinta">{entero(senalada)}</span>:
                  </span>
                  <Kmer texto={kmers[senalada] ?? ''} tamano="s" />
                  <span>
                    aparece <span className="mono cifras text-tinta">{entero(conteos[senalada])}</span> {conteos[senalada] === 1 ? 'vez' : 'veces'}
                  </span>
                </>
              )}
            </p>
          </>
        )}

        <div className="mt-5 flex flex-wrap gap-x-9 gap-y-3 border-t border-linea pt-4">
          <Dato etiqueta="Ventanas" titulo="Posiciones donde cabe un k-mer: longitud − k + 1">
            {entero(datos.ventanas)}
          </Dato>
          <Dato etiqueta="Descartadas" titulo="Ventanas con alguna base ambigua">
            {entero(datos.descartadas)}
          </Dato>
          <Dato etiqueta="K-mers distintos" titulo="Cada k-mer distinto ocupa una casilla de la tabla">
            {entero(datos.distintos)} <span className="text-sm font-normal text-tinta-3">de {entero(datos.tamanoTabla)} casillas</span>
          </Dato>
        </div>
      </section>

      <aside className="min-w-0 space-y-6">
        <section>
          <h2 className="text-sm">Colisiones al contar toda la secuencia</h2>
          <div className="mt-3 space-y-2">
            <BarraDeColisiones nombre="Sondeo lineal" valor={lineal} maximo={mayor} color={COLOR_LINEAL} />
            <BarraDeColisiones nombre="Doble hashing" valor={doble} maximo={mayor} color={COLOR_DOBLE} />
          </div>
          {lineal > 0 && doble > 0 && lineal !== doble && (
            <p className="mt-2.5 text-xs leading-snug text-tinta-2">
              {lineal > doble
                ? `El sondeo lineal chocó ${decimal(lineal / doble, 1)} veces más que el doble hashing.`
                : `El doble hashing chocó ${decimal(doble / lineal, 1)} veces más que el sondeo lineal.`}
            </p>
          )}
        </section>

        <section>
          <h2 className="text-sm">Los {datos.top.length} k-mers más frecuentes</h2>
          <p className="mb-3 mt-0.5 text-xs text-tinta-3">Salen del max-heap del motor, de mayor a menor.</p>
          <BarrasTop datos={datos.top} />
        </section>
      </aside>
    </div>
  )
}
