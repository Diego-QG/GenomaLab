import { useMemo, useRef, useState, type MouseEvent as EventoRaton, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Delaunay } from 'd3'
import type { VirusResumen } from '@compartido/contrato'
import { Cabecera, ChipGrupo, ErrorDelMotorVisible } from '@/componentes/ui'
import { useApp } from '@/estado/app'
import { colorDeGrupo, infoDeGrupo } from '@/lib/colores'
import { clases, decimal, entero } from '@/lib/formato'
import { useMedida } from '@/lib/useMedida'
import { useLote } from '@/motor/lote'
import { itemKmers } from '../analisis/pedidos'
import { Progreso } from '../analisis/Progreso'
import { proyectar, type Proyeccion } from './proyeccion'

/** Radio de cada punto, en píxeles. */
const RADIO = 4.5
/** Más lejos que esto del punto más cercano, el cursor no señala ninguno. */
const ALCANCE_DEL_CURSOR = 24
/** Espacio libre alrededor de los puntos dentro del mapa. */
const MARGEN = 30
/** Medidas de la ficha flotante, para que no se salga del mapa. */
const ANCHO_FICHA = 304
const ALTO_FICHA = 185
/** Los cosenos con k = 3 van de 0,97 a 0,99997: con 4 decimales los más cercanos saldrían como 1. */
const DECIMALES_COSENO = 5

/** Un virus ubicado en el plano. `k` = su posición en `proyeccion.puntos` (y en la matriz de cosenos). */
interface Estrella {
  k: number
  virus: VirusResumen
  x: number
  y: number
  color: string
}

interface Grupo {
  nombre: string
  cantidad: number
  color: string
  descripcion: string
}

function porcentaje(fraccion: number): string {
  return `${decimal(fraccion * 100, 1)} %`
}

// ── Mapa ─────────────────────────────────────────────────────────────────────

interface Geometria {
  px: Float64Array
  py: Float64Array
  /** Dónde cae el centro de todos los virus (el origen de los dos ejes). */
  origenX: number
  origenY: number
}

/** Coordenadas del plano → píxeles, con la misma escala en x y en y para que las distancias se respeten. */
function ubicar(estrellas: readonly Estrella[], ancho: number, alto: number): Geometria {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const e of estrellas) {
    minX = Math.min(minX, e.x)
    maxX = Math.max(maxX, e.x)
    minY = Math.min(minY, e.y)
    maxY = Math.max(maxY, e.y)
  }
  const util = (medida: number): number => Math.max(1, medida - 2 * MARGEN)
  const escalaX = maxX > minX ? util(ancho) / (maxX - minX) : Infinity
  const escalaY = maxY > minY ? util(alto) / (maxY - minY) : Infinity
  const minima = Math.min(escalaX, escalaY)
  const escala = Number.isFinite(minima) ? minima : 1 // todos en el mismo punto
  const centroX = Number.isFinite(minX) ? (minX + maxX) / 2 : 0
  const centroY = Number.isFinite(minY) ? (minY + maxY) / 2 : 0
  const aX = (x: number): number => ancho / 2 + (x - centroX) * escala
  const aY = (y: number): number => alto / 2 - (y - centroY) * escala // en pantalla, y crece hacia abajo

  const px = new Float64Array(estrellas.length)
  const py = new Float64Array(estrellas.length)
  estrellas.forEach((e, i) => {
    px[i] = aX(e.x)
    py[i] = aY(e.y)
  })
  return { px, py, origenX: aX(0), origenY: aY(0) }
}

interface PropsMapa {
  proyeccion: Proyeccion
  estrellas: readonly Estrella[]
  /** Posición de cada grupo en el orden de dibujo (los grandes primero, quedan debajo). */
  rango: ReadonlyMap<string, number>
  resaltado: string | null
  virusActual: string | null
  alAbrir: (id: string) => void
}

function Mapa({ proyeccion, estrellas, rango, resaltado, virusActual, alAbrir }: PropsMapa) {
  const caja = useRef<HTMLDivElement>(null)
  const { ancho, alto } = useMedida(caja)
  const [senalado, setSenalado] = useState<number | null>(null)
  const ultimo = useRef(0)

  const geometria = useMemo(() => (ancho > 0 && alto > 0 ? ubicar(estrellas, ancho, alto) : null), [estrellas, ancho, alto])

  // Orden de dibujo: grupos grandes primero; el grupo resaltado, encima de todos
  const orden = useMemo(() => {
    const clave = (e: Estrella): number => (e.virus.grupo === resaltado ? Number.MAX_SAFE_INTEGER : (rango.get(e.virus.grupo) ?? 0))
    return estrellas.map((_, i) => i).sort((a, b) => clave(estrellas[a]) - clave(estrellas[b]) || a - b)
  }, [estrellas, rango, resaltado])

  // Con un grupo resaltado, el cursor solo señala virus de ese grupo
  const buscador = useMemo(() => {
    if (!geometria) return null
    const activos = estrellas.map((_, i) => i).filter((i) => resaltado === null || estrellas[i].virus.grupo === resaltado)
    if (activos.length === 0) return null
    const coordenadas = new Float64Array(activos.length * 2)
    activos.forEach((i, j) => {
      coordenadas[2 * j] = geometria.px[i]
      coordenadas[2 * j + 1] = geometria.py[i]
    })
    return { activos, delaunay: new Delaunay(coordenadas) }
  }, [geometria, estrellas, resaltado])

  /** El virus más cercano al cursor (d3.Delaunay), si está a menos de ALCANCE_DEL_CURSOR. Lo usan el paso y el clic. */
  const bajoElCursor = (e: EventoRaton<SVGSVGElement>): number | null => {
    if (!geometria || !buscador) return null
    const caja = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - caja.left
    const y = e.clientY - caja.top
    const j = buscador.delaunay.find(x, y, Math.min(ultimo.current, buscador.activos.length - 1))
    if (!(j >= 0 && j < buscador.activos.length)) return null
    ultimo.current = j
    const i = buscador.activos[j]
    return Math.hypot(geometria.px[i] - x, geometria.py[i] - y) <= ALCANCE_DEL_CURSOR ? i : null
  }

  const puntos = useMemo(() => {
    if (!geometria) return null
    return orden.map((i) => {
      const e = estrellas[i]
      const apagado = resaltado !== null && e.virus.grupo !== resaltado
      return (
        <circle
          key={e.virus.id}
          data-virus={e.virus.id}
          cx={geometria.px[i]}
          cy={geometria.py[i]}
          r={RADIO}
          fill={e.color}
          fillOpacity={apagado ? 0.1 : 0.88}
          stroke="var(--color-superficie)"
          strokeOpacity={apagado ? 0.2 : 0.9}
          strokeWidth={1}
          style={{ transition: 'fill-opacity 150ms, stroke-opacity 150ms' }}
        />
      )
    })
  }, [geometria, orden, estrellas, resaltado])

  const { autovalores, traza } = proyeccion
  const actual = virusActual === null ? -1 : estrellas.findIndex((e) => e.virus.id === virusActual)
  const s = senalado !== null && senalado < estrellas.length ? senalado : null

  return (
    <div ref={caja} className="relative min-h-0 flex-1 overflow-hidden">
      {/* Luz tenue de fondo, como el centro de una galaxia */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(55% 55% at 50% 50%, rgba(122, 99, 232, 0.07), transparent 72%)' }}
      />
      {geometria && (
        <svg
          width={ancho}
          height={alto}
          className="absolute inset-0 block"
          style={{ cursor: s !== null ? 'pointer' : 'default' }}
          role="img"
          aria-label={`Mapa de ${entero(estrellas.length)} virus: cerca quedan los de conteos de 3-mers parecidos`}
          data-galaxia={estrellas.length}
          onMouseMove={(e) => setSenalado(bajoElCursor(e))}
          onMouseLeave={() => setSenalado(null)}
          onClick={(e) => {
            const i = bajoElCursor(e)
            if (i !== null) alAbrir(estrellas[i].virus.id)
          }}
        >
          {/* Los dos ejes pasan por el centro de todos los virus */}
          {traza > 0 && estrellas.length > 1 && (
            <g aria-hidden>
              <line x1={0} x2={ancho} y1={geometria.origenY} y2={geometria.origenY} className="stroke-linea-fuerte" strokeDasharray="2 4" />
              <line x1={geometria.origenX} x2={geometria.origenX} y1={0} y2={alto} className="stroke-linea-fuerte" strokeDasharray="2 4" />
              <text x={ancho - 10} y={geometria.origenY - 7} textAnchor="end" className="fill-tinta-3 text-[11px]" style={{ fontStretch: '78%' }}>
                eje 1 · {porcentaje(autovalores[0] / traza)}
              </text>
              <text x={geometria.origenX + 7} y={16} className="fill-tinta-3 text-[11px]" style={{ fontStretch: '78%' }}>
                eje 2 · {porcentaje(autovalores[1] / traza)}
              </text>
            </g>
          )}

          <motion.g initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            {puntos}
          </motion.g>

          {/* El virus en estudio: anillo claro */}
          {actual >= 0 && (
            <motion.circle
              cx={geometria.px[actual]}
              cy={geometria.py[actual]}
              r={RADIO + 4.5}
              fill="none"
              stroke="var(--color-hueso)"
              strokeWidth={1.75}
              pointerEvents="none"
              data-virus-actual={estrellas[actual].virus.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
            />
          )}

          {/* El señalado, encima de todo */}
          {s !== null && (
            <circle
              cx={geometria.px[s]}
              cy={geometria.py[s]}
              r={RADIO + 1.5}
              fill={estrellas[s].color}
              stroke="var(--color-hueso)"
              strokeWidth={2}
              pointerEvents="none"
            />
          )}
        </svg>
      )}

      {geometria && s !== null && (
        <Ficha
          estrella={estrellas[s]}
          estrellas={estrellas}
          cosenos={proyeccion.cosenos}
          actual={actual >= 0 ? estrellas[actual] : null}
          x={geometria.px[s]}
          y={geometria.py[s]}
          ancho={ancho}
          alto={alto}
        />
      )}
    </div>
  )
}

// ── Ficha flotante del virus señalado ────────────────────────────────────────

interface PropsFicha {
  estrella: Estrella
  estrellas: readonly Estrella[]
  cosenos: Float64Array
  actual: Estrella | null
  x: number
  y: number
  ancho: number
  alto: number
}

function Ficha({ estrella, estrellas, cosenos, actual, x, y, ancho, alto }: PropsFicha) {
  const n = estrellas.length
  const { k, virus } = estrella

  // Su más parecido de verdad (coseno de los 64 conteos), que no siempre es el más cercano en el mapa
  let vecino = -1
  for (let j = 0; j < n; j++) if (j !== k && (vecino < 0 || cosenos[k * n + j] > cosenos[k * n + vecino])) vecino = j

  const aLaIzquierda = x + 14 + ANCHO_FICHA > ancho && x - 14 - ANCHO_FICHA >= 0
  const arriba = y + 14 + ALTO_FICHA > alto && y - 14 - ALTO_FICHA >= 0
  const izquierda = aLaIzquierda ? x - 14 - ANCHO_FICHA : Math.max(4, Math.min(x + 14, ancho - ANCHO_FICHA - 4))
  const tope = arriba ? y - 14 : y + 14

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-linea-fuerte bg-superficie-2/95 px-3 py-2.5 text-xs shadow-[0_8px_28px_-8px_rgba(0,0,0,0.6)]"
      style={{ left: izquierda, top: tope, width: ANCHO_FICHA, transform: arriba ? 'translateY(-100%)' : undefined }}
      data-senalado={virus.id}
      role="tooltip"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: estrella.color }} />
        <span className="mono truncate text-tinta">{virus.id}</span>
      </div>
      <div className="mt-1.5 flex min-w-0 items-center gap-2">
        <ChipGrupo grupo={virus.grupo} />
        <span className="truncate text-tinta-3">{infoDeGrupo(virus.grupo).descripcion}</span>
      </div>
      <p className="mt-1.5 text-tinta-3">
        <span className="mono cifras text-tinta-2">{entero(virus.longitud)}</span> bases · GC <span className="mono cifras text-tinta-2">{decimal(virus.gc, 2)}</span> %
      </p>
      <div className={clases('mt-2 space-y-1 border-t border-linea pt-2', actual === null && vecino < 0 && 'hidden')}>
        {actual && actual.k !== k && <Renglon etiqueta="Coseno con el virus en estudio">{decimal(cosenos[k * n + actual.k], DECIMALES_COSENO)}</Renglon>}
        {actual && actual.k === k && <p className="text-tinta-2">Es el virus en estudio.</p>}
        {vecino >= 0 && (
          <div>
            <Renglon etiqueta="Su más parecido (coseno)">{decimal(cosenos[k * n + vecino], DECIMALES_COSENO)}</Renglon>
            <p className="mono truncate text-2xs text-tinta-2">{estrellas[vecino].virus.id}</p>
          </div>
        )}
      </div>
      <p className="mt-2 text-2xs text-tinta-3">Clic para abrir su detalle.</p>
    </div>
  )
}

function Renglon({ etiqueta, children }: { etiqueta: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 truncate text-tinta-3">{etiqueta}</span>
      <span className="mono cifras shrink-0 text-tinta">{children}</span>
    </div>
  )
}

// ── Columna lateral ──────────────────────────────────────────────────────────

function Tarjeta({ titulo, className, children }: { titulo: string; className?: string; children: ReactNode }) {
  return (
    <section className={clases('rounded-xl border border-linea bg-superficie px-4 py-3.5', className)}>
      <h2 className="text-xs font-normal text-tinta-3">{titulo}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

interface PropsLeyenda {
  grupos: readonly Grupo[]
  resaltado: string | null
  fijo: string | null
  alPasar: (grupo: string | null) => void
  alFijar: (grupo: string) => void
}

function Leyenda({ grupos, resaltado, fijo, alPasar, alFijar }: PropsLeyenda) {
  return (
    <ul className="space-y-px" onMouseLeave={() => alPasar(null)}>
      {grupos.map((g) => (
        <li key={g.nombre}>
          <button
            type="button"
            data-grupo={g.nombre}
            aria-pressed={fijo === g.nombre}
            title={`${g.descripcion}. Clic para ${fijo === g.nombre ? 'soltarlo' : 'dejarlo resaltado'}.`}
            onMouseEnter={() => alPasar(g.nombre)}
            onFocus={() => alPasar(g.nombre)}
            onBlur={() => alPasar(null)}
            onClick={() => alFijar(g.nombre)}
            className={clases(
              'flex h-[1.625rem] w-full items-center gap-2.5 rounded-md px-2 text-left text-xs transition-[background-color,opacity] duration-150',
              fijo === g.nombre ? 'bg-superficie-3' : 'hover:bg-superficie-2',
              resaltado !== null && resaltado !== g.nombre && 'opacity-45',
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
            <span className="estrecho w-16 shrink-0 truncate text-tinta">{g.nombre}</span>
            <span className="min-w-0 flex-1 truncate text-tinta-3">{g.descripcion}</span>
            <span className="mono cifras shrink-0 text-tinta-2">{entero(g.cantidad)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── Resultado ────────────────────────────────────────────────────────────────

interface PropsResultado {
  virus: readonly VirusResumen[]
  proyeccion: Proyeccion
  virusActual: string | null
  alAbrir: (id: string) => void
}

function Resultado({ virus, proyeccion, virusActual, alAbrir }: PropsResultado) {
  const [grupoEncima, setGrupoEncima] = useState<string | null>(null)
  const [grupoFijo, setGrupoFijo] = useState<string | null>(null)
  const resaltado = grupoEncima ?? grupoFijo

  const estrellas = useMemo(
    () => proyeccion.puntos.map((p, k): Estrella => ({ k, virus: virus[p.indice], x: p.x, y: p.y, color: colorDeGrupo(virus[p.indice].grupo) })),
    [proyeccion, virus],
  )

  // Grupos presentes en el mapa, del más numeroso al menos
  const grupos = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const e of estrellas) conteo.set(e.virus.grupo, (conteo.get(e.virus.grupo) ?? 0) + 1)
    return [...conteo.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([nombre, cantidad]): Grupo => ({ nombre, cantidad, color: colorDeGrupo(nombre), descripcion: infoDeGrupo(nombre).descripcion }))
  }, [estrellas])
  const rango = useMemo(() => new Map(grupos.map((g, i) => [g.nombre, i])), [grupos])

  const sinUbicar = proyeccion.sinUbicar.map((i) => virus[i]?.id).filter((id): id is string => id !== undefined)
  const enEstudio = estrellas.find((e) => e.virus.id === virusActual)
  const { conservada, autovalores, traza } = proyeccion

  if (estrellas.length === 0) {
    return (
      <div className="grid h-full place-items-center px-8 text-center text-tinta-3">
        Ningún virus tiene 3-mers contados (solo cuentan los que tienen A, C, G y T): no hay nada que ubicar en el mapa.
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_21rem] grid-rows-[minmax(0,1fr)] gap-5 px-6 pb-4">
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-linea bg-superficie" aria-label="Mapa de los virus">
        <Mapa proyeccion={proyeccion} estrellas={estrellas} rango={rango} resaltado={resaltado} virusActual={virusActual} alAbrir={alAbrir} />
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-linea px-4 py-2 text-xs text-tinta-3">
          <span className="flex min-w-0 items-center gap-2">
            {enEstudio ? (
              <>
                <span className="h-3 w-3 shrink-0 rounded-full border-[1.75px] border-hueso" />
                <span className="truncate">
                  Virus en estudio: <span className="mono text-tinta-2">{enEstudio.virus.id}</span>
                </span>
              </>
            ) : (
              <span>Cada punto es un virus.</span>
            )}
          </span>
          <span className="shrink-0">Pasa el cursor por un punto; clic para abrir su detalle.</span>
        </div>
      </section>

      <aside className="flex min-h-0 min-w-0 flex-col gap-3">
        <Tarjeta titulo="Cómo leer el mapa" className="shrink-0">
          {conservada !== null ? (
            <>
              <p className="text-sm text-tinta" title={`Eje 1: ${porcentaje(autovalores[0] / traza)} · eje 2: ${porcentaje(autovalores[1] / traza)}`}>
                <span className="mono cifras text-xl font-semibold">{porcentaje(conservada)}</span>
                <span className="text-tinta-2"> de la variación cabe en estos dos ejes.</span>
              </p>
              <p className="mt-1.5 text-xs leading-normal text-tinta-2">
                Cerca quedan los virus con proporciones de 3-mers parecidas (coseno alto entre sus 64 conteos). Los ejes son las dos direcciones en que más
                varían (MDS clásico); lo que no cabe en ellos no se ve, así que dos puntos pueden parecer más cerca de lo que están.
              </p>
            </>
          ) : (
            <p className="text-xs leading-normal text-tinta-2">
              {estrellas.length === 1
                ? 'Solo hay un virus con 3-mers contados: no hay distancias que mostrar.'
                : 'Todos los virus tienen los mismos conteos en proporción (coseno 1): caen en el mismo punto.'}
            </p>
          )}
          {sinUbicar.length > 0 && (
            <p className="mt-2 text-xs text-aviso" title={sinUbicar.join('\n')}>
              {sinUbicar.length === 1 ? '1 virus no aparece' : `${entero(sinUbicar.length)} virus no aparecen`}: el motor no les contó ningún 3-mer.
            </p>
          )}
        </Tarjeta>

        {/* Natural de alto, pero encoge (con su propio scroll) si no cabe: otro FASTA puede traer más grupos */}
        <section className="flex min-h-0 flex-col rounded-xl border border-linea bg-superficie px-4 py-3.5" aria-label="Grupos">
          <h2 className="shrink-0 text-xs font-normal text-tinta-3">
            Grupos · {entero(estrellas.length)} {estrellas.length === 1 ? 'virus' : 'virus en el mapa'}
          </h2>
          <div className="-mx-2 mt-2 min-h-0 overflow-y-auto">
            <Leyenda
              grupos={grupos}
              resaltado={resaltado}
              fijo={grupoFijo}
              alPasar={setGrupoEncima}
              alFijar={(g) => setGrupoFijo((previo) => (previo === g ? null : g))}
            />
          </div>
          <p className="mt-2 shrink-0 text-2xs text-tinta-3">Pasa por un grupo para resaltarlo; clic para dejarlo fijo.</p>
        </section>
      </aside>
    </div>
  )
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

/**
 * Pantalla 10 — Galaxia: el motor cuenta los 3-mers de cada virus (comando `kmers`)
 * y aquí se ubican todos en un plano con MDS clásico sobre la distancia coseno.
 */
export function Galaxia() {
  const resumen = useApp((s) => s.resumen)
  const virusActual = useApp((s) => s.virusActual)
  const abrirVirus = useApp((s) => s.abrirVirus)

  const virus = useMemo(() => resumen?.virus ?? [], [resumen])
  const lote = useLote(virus.length > 0 ? 'galaxia' : null, () => virus.map((v) => itemKmers(v.id, 3)))

  // Toda la matemática (cosenos, doble centrado, autovectores) se hace una sola vez
  const proyeccion = useMemo(() => {
    const valores = lote.valores
    if (!valores || valores.length !== virus.length) return null // el resumen todavía no es el de estos conteos
    return proyectar(valores.map((v) => v.vector))
  }, [lote.valores, virus])

  if (!resumen) return null

  let escena: ReactNode
  if (virus.length === 0) {
    escena = <div className="grid h-full place-items-center text-tinta-3">El archivo no tiene virus que ubicar.</div>
  } else if (lote.error) {
    escena = <ErrorDelMotorVisible error={lote.error} alReintentar={lote.reintentar} />
  } else if (!proyeccion) {
    escena = (
      <Progreso
        titulo={virus.length === 1 ? 'Contando los 3-mers del virus…' : `Contando los 3-mers de cada uno de los ${entero(virus.length)} virus…`}
        hechos={lote.hechos}
        total={lote.total}
        unidad="virus contados"
      />
    )
  } else {
    escena = <Resultado virus={virus} proyeccion={proyeccion} virusActual={virusActual} alAbrir={(id) => abrirVirus(id)} />
  }

  return (
    <div className="flex h-full flex-col">
      <Cabecera
        titulo="Galaxia"
        descripcion={`${virus.length === 1 ? 'El virus' : `Los ${entero(virus.length)} virus`} en un mapa: el motor cuenta los 3-mers de cada uno (64 conteos) y, con MDS clásico, quedan cerca los de conteos parecidos (coseno alto).`}
      />
      <div className="min-h-0 flex-1">{escena}</div>
    </div>
  )
}
