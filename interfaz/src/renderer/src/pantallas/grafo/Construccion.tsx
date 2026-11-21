import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { RespuestaGrafo } from '@compartido/contrato'
import { Base, Kmer } from '@/componentes/Base'
import { MapaDeCalor, type CeldaSenalada } from '@/componentes/graficos/MapaDeCalor'
import { Controles } from '@/componentes/reproductor/Controles'
import { useReproductor } from '@/componentes/reproductor/useReproductor'
import { escalaFluor, esBaseValida } from '@/lib/colores'
import { clases, decimal, entero } from '@/lib/formato'

const ANCHO_BASE = 36
const ANCHO_PAREJA = ANCHO_BASE * 2 + 2
const HUECO_CORTADO = 22
const ALTO_ARCOS = 156

function Num({ children }: { children: ReactNode }) {
  return <span className="mono cifras font-semibold text-hueso">{children}</span>
}

interface Props {
  grafo: RespuestaGrafo
  secuencia: string
  /** Cuántas parejas se usan en el ejemplo (el `limiteArcos` que se le pidió al motor). */
  parejasDeEjemplo: number
}

/**
 * Cómo se construye el grafo: la secuencia se corta en parejas sin solapamiento y
 * cada pareja lanza un arco hacia todas las posteriores, con peso 1 / distancia.
 * Los arcos son los `arcosEjemplo` que devuelve el motor.
 */
export function Construccion({ grafo, secuencia, parejasDeEjemplo }: Props) {
  const [senalada, setSenalada] = useState<CeldaSenalada | null>(null)
  const arcos = grafo.arcosEjemplo
  const total = Math.max(0, Math.min(parejasDeEjemplo, grafo.parejas))

  const parejas = useMemo(() => {
    const lista = []
    for (let p = 0; p < total; p++) {
      const letras = secuencia.slice(2 * p, 2 * p + 2)
      lista.push({ letras, valida: letras.length === 2 && esBaseValida(letras[0]) && esBaseValida(letras[1]) })
    }
    return lista
  }, [secuencia, total])

  // Cuadros: 0 = la secuencia seguida · 1 = cortada en parejas · 2… = un arco por cuadro
  const reproductor = useReproductor(2 + arcos.length, { clave: grafo, msPorPaso: (paso) => (paso < 2 ? 1700 : 1100) })
  const cortada = reproductor.paso >= 1
  const arcosVistos = Math.max(0, reproductor.paso - 1)
  const actual = arcosVistos > 0 ? arcos[arcosVistos - 1] : null

  const indiceDe = useMemo(() => new Map(grafo.nombres.map((nombre, i) => [nombre, i])), [grafo.nombres])

  // La matriz del ejemplo: los pesos de los arcos mostrados, sumados en su celda
  const { parcial, previo, maximo } = useMemo(() => {
    const matriz = grafo.nombres.map(() => grafo.nombres.map(() => 0))
    let antes = 0
    let tope = 0
    arcos.forEach((arco, t) => {
      const f = indiceDe.get(arco.desde)
      const c = indiceDe.get(arco.hasta)
      if (f === undefined || c === undefined) return
      const acumulado = (t < arcosVistos ? matriz[f][c] : 0) + arco.peso
      if (t < arcosVistos) {
        if (t === arcosVistos - 1) antes = matriz[f][c]
        matriz[f][c] = acumulado
      }
    })
    // Tope de la escala: el valor más alto que llegará a tener una celda del ejemplo
    const final = new Map<string, number>()
    for (const arco of arcos) {
      const clave = `${arco.desde}>${arco.hasta}`
      const suma = (final.get(clave) ?? 0) + arco.peso
      final.set(clave, suma)
      if (suma > tope) tope = suma
    }
    return { parcial: matriz, previo: antes, maximo: tope }
  }, [arcos, arcosVistos, grafo.nombres, indiceDe])

  const escala = useMemo(() => escalaFluor(maximo), [maximo])
  const paso = ANCHO_PAREJA + (cortada ? HUECO_CORTADO : 2)
  const anchoTotal = total * (ANCHO_PAREJA + HUECO_CORTADO)
  const centro = (p: number): number => p * paso + ANCHO_PAREJA / 2

  const celdaActual: CeldaSenalada | null =
    actual && indiceDe.has(actual.desde) && indiceDe.has(actual.hasta)
      ? { fila: indiceDe.get(actual.desde) as number, columna: indiceDe.get(actual.hasta) as number }
      : null

  let narracion: ReactNode
  if (reproductor.paso === 0) {
    narracion = (
      <span>
        Las primeras <Num>{total * 2}</Num> bases de la secuencia. El grafo no mira letras sueltas: trabaja con parejas de bases.
      </span>
    )
  } else if (!actual) {
    narracion = (
      <span>
        La secuencia se corta en parejas <strong className="text-hueso">sin solapamiento</strong>: aquí hay <Num>{total}</Num>, y en toda la secuencia,{' '}
        <Num>{entero(grafo.parejas)}</Num>. Cada pareja es uno de los 16 nodos posibles (AA, AC, … TT).
      </span>
    )
  } else {
    const valorNuevo = celdaActual ? parcial[celdaActual.fila][celdaActual.columna] : actual.peso
    narracion = (
      <span>
        La pareja <Num>{actual.a}</Num> (<Kmer texto={actual.desde} tamano="s" />) apunta a la pareja <Num>{actual.b}</Num> (<Kmer texto={actual.hasta} tamano="s" />
        ): están a distancia <Num>{actual.distancia}</Num>, así que el arco pesa <Num>1/{actual.distancia}</Num>. En la matriz,{' '}
        <Num>
          {actual.desde} → {actual.hasta}
        </Num>{' '}
        pasa de <Num>{decimal(previo, 2)}</Num> a <Num>{decimal(valorNuevo, 2)}</Num>.
      </span>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_17.5rem] gap-8 overflow-y-auto px-6 pb-3">
        <section className="flex min-w-0 flex-col">
          <h2 className="text-sm">Parejas y arcos</h2>
          <p className="mt-0.5 text-xs text-tinta-3">Cada pareja lanza un arco hacia todas las que vienen después. Cuanto más lejos, menos pesa: 1 / distancia.</p>

          <div className="flex min-h-0 flex-1 items-center overflow-x-auto pb-2">
            <div className="relative mx-auto" style={{ width: anchoTotal, height: ALTO_ARCOS + 92 }}>
              <svg className="absolute left-0 top-0" width={anchoTotal} height={ALTO_ARCOS} aria-hidden>
                <defs>
                  <marker id="punta-arco" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
                    <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
                  </marker>
                </defs>
                {arcos.slice(0, arcosVistos).map((arco, t) => {
                  const esActual = t === arcosVistos - 1
                  const mismoOrigen = actual !== null && arco.a === actual.a
                  const x1 = centro(arco.a)
                  const x2 = centro(arco.b)
                  const altura = Math.min(ALTO_ARCOS - 22, 26 + arco.distancia * 17)
                  const cima = ALTO_ARCOS - 4 - altura
                  return (
                    <g key={`${arco.a}-${arco.b}`} opacity={esActual ? 1 : mismoOrigen ? 0.6 : 0.22}>
                      <motion.path
                        d={`M ${x1} ${ALTO_ARCOS - 4} Q ${(x1 + x2) / 2} ${cima - altura * 0.55} ${x2 - 3} ${ALTO_ARCOS - 6}`}
                        fill="none"
                        stroke={esActual ? 'var(--color-hueso)' : 'var(--color-fluor-5)'}
                        strokeWidth={1 + arco.peso * 4.5}
                        strokeLinecap="round"
                        markerEnd="url(#punta-arco)"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      />
                      {esActual && (
                        <text x={(x1 + x2) / 2} y={Math.max(11, cima - 4)} textAnchor="middle" className="mono fill-hueso text-[0.7rem] font-bold">
                          1/{arco.distancia} = {decimal(arco.peso, 2)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>

              {parejas.map((pareja, p) => {
                const esOrigen = actual?.a === p
                const esDestino = actual?.b === p
                return (
                  <motion.div
                    key={p}
                    className="absolute left-0"
                    style={{ top: ALTO_ARCOS, width: ANCHO_PAREJA }}
                    initial={false}
                    animate={{ x: p * paso }}
                    transition={{ type: 'spring', stiffness: 170, damping: 22, delay: cortada ? p * 0.04 : 0 }}
                  >
                    <div
                      className={clases(
                        'flex gap-0.5 rounded-lg p-0.5 transition-shadow duration-200',
                        (esOrigen || esDestino) && 'shadow-[0_0_0_2px_var(--color-hueso)]',
                        !pareja.valida && cortada && 'opacity-40',
                      )}
                    >
                      {[...pareja.letras].map((letra, i) => (
                        <Base key={i} letra={letra} tamano="l" style={{ width: ANCHO_BASE - 2 }} />
                      ))}
                    </div>
                    <div className={clases('mt-1.5 text-center transition-opacity duration-300', !cortada && 'opacity-0')}>
                      <div className="mono cifras text-xs text-tinta-2">pareja {p}</div>
                      <div className="text-2xs text-tinta-3">{pareja.valida ? (esOrigen ? 'origen' : esDestino ? 'destino' : ' ') : 'ambigua: se salta'}</div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        <aside className="min-w-0">
          <h2 className="text-sm">La matriz se va llenando</h2>
          <p className="mb-2 mt-0.5 text-xs text-tinta-3">Fila = pareja de origen, columna = destino. Los arcos repetidos se suman.</p>
          <MapaDeCalor
            matriz={parcial}
            nombres={grafo.nombres}
            color={(v) => (v === 0 ? '#161829' : escala(v))}
            senalada={senalada}
            alSenalar={setSenalada}
            destello={celdaActual}
            describir={(f, c, v) => `${grafo.nombres[f]} → ${grafo.nombres[c]}: ${decimal(v, 2)}`}
            etiquetaAccesible="Matriz del ejemplo, llenándose"
          />
          <p className="mt-2 min-h-5 text-xs text-tinta-2">
            {senalada ? (
              <>
                <span className="mono font-bold text-tinta">
                  {grafo.nombres[senalada.fila]} → {grafo.nombres[senalada.columna]}
                </span>
                : {decimal(parcial[senalada.fila][senalada.columna], 2)} hasta este paso
              </>
            ) : (
              <span className="text-tinta-3">Con estas {total} parejas hay {arcos.length} arcos.</span>
            )}
          </p>
        </aside>
      </div>

      <Controles reproductor={reproductor} narracion={narracion} />
    </div>
  )
}
