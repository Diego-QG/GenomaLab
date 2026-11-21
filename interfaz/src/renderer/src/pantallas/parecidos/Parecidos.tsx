import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import type { VirusResumen } from '@compartido/contrato'
import { SelectorVirus } from '@/componentes/SelectorVirus'
import { Cabecera, ChipGrupo, ErrorDelMotorVisible } from '@/componentes/ui'
import { useApp } from '@/estado/app'
import { colorDeGrupo } from '@/lib/colores'
import { clases, decimal, entero, limitar } from '@/lib/formato'
import { useMedida } from '@/lib/useMedida'
import { useLote } from '@/motor/lote'
import { itemComparar, type Similitudes } from '../analisis/pedidos'
import { Progreso } from '../analisis/Progreso'

/** Cuántos virus muestra el ranking. */
const TOP = 10

interface Pariente extends Similitudes {
  id: string
  grupo: string
}

/** El chip de grupo de ui.tsx, pero que recorta el nombre en vez de desbordarse (grupos de otros FASTA). */
const CHIP_QUE_CABE = '[&>span:first-child]:shrink-0 [&>span:last-child]:min-w-0 [&>span:last-child]:truncate'

const oMenosInfinito = (n: number): number => (Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY)

/** De mayor a menor similitud con k = 6; lo que el motor no envió (NaN) va al final, ordenado por k = 3. */
function ordenar(a: Pariente, b: Pariente): number {
  const ka = oMenosInfinito(a.k6)
  const kb = oMenosInfinito(b.k6)
  if (kb !== ka) return kb - ka
  const ta = oMenosInfinito(a.k3)
  const tb = oMenosInfinito(b.k3)
  return tb !== ta ? tb - ta : a.id.localeCompare(b.id)
}

// Cada lista de virus de un `resumen` recibe un número. Va en la clave del lote: si el
// resumen se vuelve a pedir (otro motor u otro archivo), el trabajo se arma con la lista
// nueva y sus resultados nunca se emparejan con los virus de la anterior.
const numeroDeLista = new WeakMap<readonly VirusResumen[], number>()
let ultimaLista = 0

function idDeLista(lista: readonly VirusResumen[]): number {
  let n = numeroDeLista.get(lista)
  if (n === undefined) {
    n = ++ultimaLista
    numeroDeLista.set(lista, n)
  }
  return n
}

// ── Ranking ──────────────────────────────────────────────────────────────────

/** Alto de una fila del ranking si no hay medida (o hay menos de 10 filas). */
const FILA_POR_DEFECTO = 40
/** Lo que ocupa la escena además de las filas: pb-4, cabecera de la tabla, bordes, nota de abajo (2 líneas) y holgura. */
const FUERA_DE_LAS_FILAS = 16 + 37 + 2 + 42 + 6

function Barra({ valor }: { valor: number }) {
  const ancho = Number.isFinite(valor) ? limitar(valor, 0, 1) * 100 : 0
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-superficie-3">
        <motion.span
          className="block h-full rounded-full bg-fluor-4"
          initial={{ width: 0 }}
          animate={{ width: `${ancho}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </span>
      <span className="mono cifras font-semibold text-tinta">{decimal(valor, 4)}</span>
    </span>
  )
}

function Ranking({ lista, altoFila, alAbrir }: { lista: Pariente[]; altoFila: number; alAbrir: (id: string) => void }) {
  const alTeclear = (e: KeyboardEvent, id: string): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      alAbrir(id)
    }
  }
  return (
    <section className="overflow-hidden rounded-xl border border-linea bg-superficie" aria-label={lista.length === 1 ? 'El más parecido' : `Los ${lista.length} más parecidos`}>
      <table className="w-full table-fixed border-collapse text-xs" id="ranking-parecidos">
        {/* Columnas fijas estrechas: el resto del ancho es para el id, que es largo */}
        <colgroup>
          <col className="w-9" />
          <col />
          <col className="w-24" />
          <col className="w-16" />
          <col className="w-36" />
          <col className="w-16" />
          <col className="w-8" />
        </colgroup>
        <thead>
          <tr className="border-b border-linea text-left text-tinta-3">
            <th scope="col" className="py-2.5 pl-4 font-normal">
              #
            </th>
            <th scope="col" className="py-2.5 font-normal">
              Virus
            </th>
            <th scope="col" className="py-2.5 font-normal">
              Grupo
            </th>
            <th scope="col" className="py-2.5 text-right font-normal" title="Coseno entre los vectores de 64 conteos de 3-mers">
              k = 3
            </th>
            <th scope="col" aria-sort="descending" className="py-2.5 pl-5 font-normal text-tinta" title="Coseno entre los vectores de 4096 conteos de 6-mers">
              k = 6 ↓
            </th>
            <th scope="col" className="py-2.5 pr-1 text-right font-normal" title="Coseno entre las dos matrices 16 × 16 del grafo de parejas">
              Grafo
            </th>
            <th scope="col">
              <span className="sr-only">Abrir</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p, i) => (
            <tr
              key={p.id}
              data-pariente={p.id}
              tabIndex={0}
              style={{ height: altoFila }}
              onClick={() => alAbrir(p.id)}
              onKeyDown={(e) => alTeclear(e, p.id)}
              title={`Abrir la comparación con ${p.id}`}
              className="group cursor-pointer border-b border-linea/60 outline-none last:border-b-0 hover:bg-superficie-2 focus-visible:bg-superficie-2"
            >
              <td className="mono cifras pl-4 text-tinta-3">{i + 1}</td>
              <td className="pr-3">
                <span className="mono block truncate text-tinta">{p.id}</span>
              </td>
              <td className="pr-2">
                <ChipGrupo grupo={p.grupo} className={clases('max-w-full', CHIP_QUE_CABE)} />
              </td>
              <td className="mono cifras text-right text-tinta-2">{decimal(p.k3, 4)}</td>
              <td className="pl-5">
                <Barra valor={p.k6} />
              </td>
              <td className="mono cifras pr-1 text-right text-tinta-2">{decimal(p.grafo, 4)}</td>
              <td className="text-center text-tinta-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <ArrowRight size={14} className="inline" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// ── Franjas: todos los demás sobre el eje de similitud k = 6, una fila por grupo ──

const FRANJA_MIN = 10
const FRANJA_MAX = 26
/** Alto de las marcas del eje, debajo de las filas. */
const EJE = 18
/** Ancho de la columna con el nombre del grupo. */
const ETIQUETA = 62

function recortar(texto: string, maximo: number): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto
}

function Franjas({
  todos,
  destacados,
  grupoElegido,
  alAbrir,
}: {
  todos: Pariente[]
  destacados: ReadonlySet<string>
  grupoElegido: string
  alAbrir: (id: string) => void
}) {
  // La caja toma el alto que le deja la columna; el dibujo se adapta a ella (no al revés)
  const caja = useRef<HTMLDivElement>(null)
  const { ancho, alto } = useMedida(caja)
  const [senalado, setSenalado] = useState<Pariente | null>(null)

  /** Grupos de más a menos virus. */
  const grupos = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const p of todos) conteo.set(p.grupo, (conteo.get(p.grupo) ?? 0) + 1)
    return [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([g]) => g)
  }, [todos])

  const validos = useMemo(() => todos.filter((p) => Number.isFinite(p.k6)), [todos])
  // Los del ranking se dibujan al final para que queden encima
  const enOrden = useMemo(() => [...validos].sort((a, b) => Number(destacados.has(a.id)) - Number(destacados.has(b.id))), [validos, destacados])

  // Si hay más grupos de los que caben (FASTA con muchos grupos), los más pequeños comparten la última fila
  const caben = Math.max(1, Math.floor((alto - EJE) / FRANJA_MIN))
  const visibles = grupos.length <= caben ? grupos : grupos.slice(0, caben - 1)
  const juntos = grupos.slice(visibles.length)
  const filas = visibles.length + (juntos.length > 0 ? 1 : 0)
  const franja = limitar(Math.floor((alto - EJE) / Math.max(1, filas)), FRANJA_MIN, FRANJA_MAX)
  const altoFilas = filas * franja
  const filaDe = new Map(visibles.map((g, i) => [g, i]))

  const menor = validos.length > 0 ? Math.min(...validos.map((p) => p.k6)) : 0
  // El eje llega siempre a 1; empieza en la décima de abajo (y como mucho en 0.9, para que no se cierre)
  const minimo = Math.min(0.9, Math.floor(menor * 10) / 10)
  const inicio = ETIQUETA + 8
  const largo = Math.max(10, ancho - inicio - 6)
  const x = (v: number): number => inicio + ((limitar(v, minimo, 1) - minimo) / (1 - minimo)) * largo
  const y = (grupo: string): number => (filaDe.get(grupo) ?? visibles.length) * franja + franja / 2
  const marcas = [minimo, (minimo + 1) / 2, 1]

  let pie: ReactNode
  if (senalado) {
    // El valor primero: si el id es largo, lo que se recorta es el id
    pie = (
      <>
        k = 6 <span className="mono cifras text-tinta">{decimal(senalado.k6, 4)}</span> · <span className="mono text-tinta">{senalado.id}</span>
      </>
    )
  } else if (destacados.size < todos.length) {
    pie = `Con borde claro, los ${entero(destacados.size)} de la tabla.`
  } else {
    pie = 'Clic en un punto para abrir la comparación.'
  }

  return (
    <>
      <div ref={caja} className="relative min-h-0 flex-1">
        {validos.length === 0 ? (
          <p className="text-xs text-tinta-3">El motor no envió la similitud con k = 6: no hay puntos que dibujar.</p>
        ) : (
          ancho > 0 &&
          alto > 0 && (
            <svg
              width={ancho}
              height={altoFilas + EJE}
              className="absolute left-0 top-0 overflow-visible"
              role="img"
              aria-label="Similitud k = 6 con cada uno de los demás virus, una fila por grupo"
            >
              {marcas.map((m, i) => (
                <g key={i}>
                  <line x1={x(m)} x2={x(m)} y1={0} y2={altoFilas} className="stroke-linea" strokeDasharray="2 3" />
                  <text x={x(m)} y={altoFilas + 13} textAnchor="middle" className="fill-tinta-3 font-mono text-[10px]">
                    {decimal(m, 2)}
                  </text>
                </g>
              ))}
              {visibles.map((g, i) => (
                <text
                  key={g}
                  x={0}
                  y={i * franja + franja / 2 + 4}
                  className={clases('text-[11px]', g === grupoElegido ? 'fill-tinta font-semibold' : 'fill-tinta-2')}
                  style={{ fontStretch: '78%' }}
                >
                  <title>{g === grupoElegido ? `${g} (el grupo del virus elegido)` : g}</title>
                  {recortar(g, 10)}
                </text>
              ))}
              {juntos.length > 0 && (
                <text x={0} y={visibles.length * franja + franja / 2 + 4} className="fill-tinta-3 text-[11px]" style={{ fontStretch: '78%' }}>
                  <title>{recortar(juntos.join(', '), 300)}</title>
                  {`+${entero(juntos.length)} grupos`}
                </text>
              )}
              {enOrden.map((p) => {
                const destacado = destacados.has(p.id)
                return (
                  <circle
                    key={p.id}
                    cx={x(p.k6)}
                    cy={y(p.grupo)}
                    r={destacado ? 4.5 : 3.5}
                    fill={colorDeGrupo(p.grupo)}
                    fillOpacity={destacado ? 1 : 0.55}
                    strokeWidth={1.5}
                    className={clases('cursor-pointer', destacado ? 'stroke-hueso' : 'stroke-none')}
                    onMouseEnter={() => setSenalado(p)}
                    onMouseLeave={() => setSenalado(null)}
                    onClick={() => alAbrir(p.id)}
                  />
                )
              })}
              {senalado && Number.isFinite(senalado.k6) && (
                <circle cx={x(senalado.k6)} cy={y(senalado.grupo)} r={7.5} fill="none" strokeWidth={1.5} className="pointer-events-none stroke-tinta" />
              )}
            </svg>
          )
        )}
      </div>
      <p className="mt-1 h-4 shrink-0 truncate text-2xs text-tinta-3">{pie}</p>
    </>
  )
}

// ── Resultado ────────────────────────────────────────────────────────────────

function Tarjeta({ titulo, className, cuerpo, children }: { titulo: string; className?: string; cuerpo?: string; children: ReactNode }) {
  return (
    <section className={clases('rounded-xl border border-linea bg-superficie px-4 py-3.5', className)}>
      <h2 className="truncate text-xs font-normal text-tinta-3">{titulo}</h2>
      <div className={clases('mt-2', cuerpo)}>{children}</div>
    </section>
  )
}

/** Qué se dice del grupo del virus elegido (se cuenta en el resumen, no se inventa). */
function frasesDelGrupo(grupo: string, companeros: number, enLaTabla: number): string {
  if (companeros === 0) return `Es el único virus del grupo ${grupo} en el archivo.`
  const cuantos = companeros === 1 ? 'otro virus' : `otros ${entero(companeros)} virus`
  const todos = enLaTabla === companeros ? (companeros === 1 ? ': está en la tabla' : ': están todos en la tabla') : ''
  return `Su grupo (${grupo}) tiene ${cuantos} en el archivo${todos}.`
}

function Resultado({ elegido, parientes, alAbrir }: { elegido: VirusResumen; parientes: Pariente[]; alAbrir: (id: string) => void }) {
  // El alto de la escena lo fija la ventana; las filas se estiran para llenarlo (sin pasarse)
  const escena = useRef<HTMLDivElement>(null)
  const { alto } = useMedida(escena)

  const top = useMemo(() => parientes.slice(0, TOP), [parientes])
  const destacados = useMemo(() => new Set(top.map((p) => p.id)), [top])
  const sinK6 = useMemo(() => parientes.filter((p) => !Number.isFinite(p.k6)).length, [parientes])

  const companeros = parientes.filter((p) => p.grupo === elegido.grupo).length
  const delMismoGrupo = top.filter((p) => p.grupo === elegido.grupo).length
  const puestoOtro = parientes.findIndex((p) => p.grupo !== elegido.grupo)
  const deOtroGrupo = puestoOtro >= 0 ? parientes[puestoOtro] : null

  const altoFila = top.length < TOP || alto === 0 ? FILA_POR_DEFECTO : limitar(Math.floor((alto - FUERA_DE_LAS_FILAS) / TOP), 36, 52)

  return (
    <div ref={escena} className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_19rem] gap-5 overflow-y-auto px-6 pb-4">
      <div className="min-w-0">
        <Ranking lista={top} altoFila={altoFila} alAbrir={alAbrir} />
        <p className="mt-2.5 text-xs text-tinta-3">
          Ordenado por la similitud con k = 6. Clic en una fila para abrir la comparación.
          {sinK6 > 0 && (
            <span className="text-aviso">
              {' '}
              Al motor le faltó la similitud con k = 6 en {entero(sinK6)} de {entero(parientes.length)} comparaciones («—»): van al final, por k = 3.
            </span>
          )}
        </p>
      </div>

      <aside className="flex min-h-0 min-w-0 flex-col gap-3">
        <Tarjeta titulo="Virus elegido">
          <div className="flex min-w-0 items-center gap-2">
            <span className="mono truncate text-xs text-tinta" title={elegido.id}>
              {elegido.id}
            </span>
            <ChipGrupo grupo={elegido.grupo} className={clases('max-w-[45%]', CHIP_QUE_CABE)} />
          </div>
          <p className="mt-1 text-xs text-tinta-3">
            {entero(elegido.longitud)} bases · GC {decimal(elegido.gc, 2)} %
          </p>
        </Tarjeta>

        <Tarjeta titulo={top.length === 1 ? 'El más parecido' : `Entre los ${entero(top.length)} más parecidos`}>
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="mono cifras text-xl font-semibold leading-7 text-tinta">{entero(delMismoGrupo)}</span>
            <span className="truncate text-sm text-tinta-2">{delMismoGrupo === 1 ? 'es de su mismo grupo' : 'son de su mismo grupo'}</span>
          </p>
          <p className="mt-0.5 text-xs text-tinta-3">{frasesDelGrupo(elegido.grupo, companeros, delMismoGrupo)}</p>

          <div className="mt-3 border-t border-linea pt-2.5">
            <div className="text-xs text-tinta-3">El más parecido de otro grupo</div>
            {deOtroGrupo ? (
              <button
                type="button"
                onClick={() => alAbrir(deOtroGrupo.id)}
                title={`Abrir la comparación con ${deOtroGrupo.id}`}
                className="group mt-1 block w-full min-w-0 rounded-md text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="mono truncate text-xs text-tinta group-hover:underline">{deOtroGrupo.id}</span>
                  <ChipGrupo grupo={deOtroGrupo.grupo} className={clases('max-w-[45%]', CHIP_QUE_CABE)} />
                </span>
                <span className="mt-0.5 block text-xs text-tinta-3">
                  puesto <span className="mono cifras text-tinta-2">{entero(puestoOtro + 1)}</span> de {entero(parientes.length)} · k = 6{' '}
                  <span className="mono cifras text-tinta-2">{decimal(deOtroGrupo.k6, 4)}</span>
                </span>
              </button>
            ) : (
              <p className="mt-1 text-xs text-tinta-2">Todos los demás virus son de su mismo grupo.</p>
            )}
          </div>
        </Tarjeta>

        <Tarjeta
          titulo={`${parientes.length === 1 ? 'El otro virus' : `Los otros ${entero(parientes.length)}`} por grupo (k = 6)`}
          className="flex min-h-[11rem] flex-1 flex-col"
          cuerpo="flex min-h-0 flex-1 flex-col"
        >
          <Franjas todos={parientes} destacados={destacados} grupoElegido={elegido.grupo} alAbrir={alAbrir} />
        </Tarjeta>
      </aside>
    </div>
  )
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

function conCadaUno(demas: number): string {
  if (demas === 1) return 'con el otro virus del archivo'
  if (demas === 0) return 'con cada uno de los demás'
  return `con cada uno de los otros ${entero(demas)}`
}

/**
 * Pantalla 9 — ¿A quién se parece?: el motor compara el virus elegido con cada uno
 * de los demás (comando `comparar`) y aquí se ordenan por similitud con k = 6.
 */
export function Parecidos() {
  const resumen = useApp((s) => s.resumen)
  const id = useApp((s) => s.virusActual)
  const elegirVirus = useApp((s) => s.elegirVirus)
  const elegirComparado = useApp((s) => s.elegirComparado)
  const ir = useApp((s) => s.ir)

  const elegido = resumen?.virus.find((v) => v.id === id) ?? null
  const otros = useMemo(() => (resumen && elegido ? resumen.virus.filter((v) => v.id !== elegido.id) : []), [resumen, elegido])

  // Sin virus válido o sin con quién compararlo no se lanza nada
  const clave = resumen && elegido && otros.length > 0 ? `parecidos|${idDeLista(resumen.virus)}|${elegido.id}` : null
  const lote = useLote(clave, () => (elegido ? otros.map((v) => itemComparar(elegido.id, v.id)) : []))

  const parientes = useMemo(() => {
    const valores = lote.valores
    if (!valores || valores.length !== otros.length) return null
    return otros.map((v, i): Pariente => ({ id: v.id, grupo: v.grupo, ...valores[i] })).sort(ordenar)
  }, [lote.valores, otros])

  if (!resumen) return null

  const abrirComparacion = (otro: string): void => {
    elegirComparado(otro)
    ir('comparar')
  }

  let escena: ReactNode
  if (!elegido) {
    escena = <div className="grid h-full place-items-center text-tinta-3">Elige un virus para buscar a quién se parece.</div>
  } else if (otros.length === 0) {
    escena = <div className="grid h-full place-items-center text-tinta-3">El archivo tiene un solo virus: no hay con quién compararlo.</div>
  } else if (lote.error) {
    escena = <ErrorDelMotorVisible error={lote.error} alReintentar={lote.reintentar} />
  } else if (!parientes) {
    escena = (
      <Progreso
        titulo={`Comparando ${elegido.id} ${otros.length === 1 ? 'con el otro virus' : `con los otros ${entero(otros.length)} virus`}…`}
        hechos={lote.hechos}
        total={lote.total}
        unidad={otros.length === 1 ? 'comparación' : 'comparaciones'}
      />
    )
  } else {
    escena = <Resultado elegido={elegido} parientes={parientes} alAbrir={abrirComparacion} />
  }

  return (
    <div className="flex h-full flex-col">
      <Cabecera
        titulo="¿A quién se parece?"
        descripcion={`El motor compara el virus elegido ${conCadaUno(Math.max(0, resumen.virus.length - 1))} (comando comparar): similitud de k-mers con k = 3 y k = 6, y de sus grafos de parejas.`}
      >
        <SelectorVirus valor={id} alElegir={elegirVirus} etiqueta="Virus" alineacion="derecha" />
      </Cabecera>
      <div className="min-h-0 flex-1">{escena}</div>
    </div>
  )
}
