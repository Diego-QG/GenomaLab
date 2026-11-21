import { memo, useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { BaseAmbigua } from '@compartido/contrato'
import { dibujarFranjas } from '@/componentes/CodigoDeBarras'
import { SIGNIFICADO_IUPAC, esBaseValida } from '@/lib/colores'
import { clases, entero } from '@/lib/formato'
import { useMedida } from '@/lib/useMedida'

const ALTO_FILA = 26
const ANCHO_CELDA = 16 // .celda-base
const HUECO_CELDA = 1
const HUECO_GRUPO = 8
const ANCHO_ETIQUETA = 64
const GRUPO = 10

function basesPorFila(ancho: number): number {
  const anchoGrupo = GRUPO * (ANCHO_CELDA + HUECO_CELDA) + HUECO_GRUPO
  return Math.max(GRUPO, Math.floor((ancho - ANCHO_ETIQUETA) / anchoGrupo) * GRUPO)
}

interface PropsFila {
  secuencia: string
  inicio: number
  porFila: number
  resaltada: number | null
}

const Fila = memo(function Fila({ secuencia, inicio, porFila, resaltada }: PropsFila) {
  const grupos = []
  for (let g = inicio; g < Math.min(inicio + porFila, secuencia.length); g += GRUPO) {
    const celdas = []
    for (let i = g; i < Math.min(g + GRUPO, secuencia.length); i++) {
      const letra = secuencia[i]
      const valida = esBaseValida(letra)
      celdas.push(
        <span
          key={i}
          data-pos={i}
          className={clases('celda-base', valida ? `celda-${letra}` : 'celda-N', resaltada === i && 'animate-pulse')}
          title={valida ? undefined : `Posición ${i}: ${letra} = ${SIGNIFICADO_IUPAC[letra] ?? 'base ambigua'}`}
        >
          {letra}
        </span>,
      )
    }
    grupos.push(
      <span key={g} className="inline-flex" style={{ gap: HUECO_CELDA, marginRight: HUECO_GRUPO }}>
        {celdas}
      </span>,
    )
  }
  return (
    <div className="absolute left-0 flex items-center" style={{ top: (inicio / porFila) * ALTO_FILA, height: ALTO_FILA }}>
      <span className="mono cifras shrink-0 pr-3 text-right text-2xs text-tinta-3" style={{ width: ANCHO_ETIQUETA }}>
        {entero(inicio)}
      </span>
      {grupos}
    </div>
  )
})

export interface ControlSecuencia {
  /** Desplaza hasta una posición y la resalta un momento. */
  irA: (posicion: number) => void
}

interface Props {
  secuencia: string
  ambiguas: BaseAmbigua[]
  control?: Ref<ControlSecuencia>
}

/**
 * La secuencia completa, coloreada por base. Solo se dibujan las filas visibles
 * (scroll virtualizado). Arriba, una franja con toda la secuencia sirve de mapa.
 */
export function Secuencia({ secuencia, ambiguas, control }: Props) {
  const ventana = useRef<HTMLDivElement>(null)
  const mapa = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const { ancho, alto } = useMedida(ventana)
  const { ancho: anchoMapa } = useMedida(mapa)
  const [desplazamiento, setDesplazamiento] = useState(0)
  const [senalada, setSenalada] = useState<number | null>(null)
  const [resaltada, setResaltada] = useState<number | null>(null)

  const porFila = basesPorFila(ancho)
  const filas = Math.ceil(secuencia.length / porFila)
  const primera = Math.max(0, Math.floor(desplazamiento / ALTO_FILA) - 2)
  const ultima = Math.min(filas - 1, Math.floor((desplazamiento + alto) / ALTO_FILA) + 2)

  useEffect(() => {
    ventana.current?.scrollTo({ top: 0 })
    setDesplazamiento(0)
  }, [secuencia])

  useEffect(() => {
    if (lienzo.current && anchoMapa > 0) dibujarFranjas(lienzo.current, secuencia, anchoMapa, 18, 1, 1)
  }, [secuencia, anchoMapa])

  const irA = useCallback(
    (posicion: number) => {
      const fila = Math.floor(posicion / porFila)
      ventana.current?.scrollTo({ top: Math.max(0, fila * ALTO_FILA - alto / 2 + ALTO_FILA), behavior: 'smooth' })
      setResaltada(posicion)
      window.setTimeout(() => setResaltada((r) => (r === posicion ? null : r)), 2400)
    },
    [porFila, alto],
  )

  useImperativeHandle(control, () => ({ irA }), [irA])

  // Tramo visible, para marcarlo en el mapa
  const primeraVisible = Math.floor(desplazamiento / ALTO_FILA) * porFila
  const visibles = Math.ceil(alto / ALTO_FILA) * porFila
  const letraSenalada = senalada === null ? null : secuencia[senalada]

  const indices = []
  for (let f = primera; f <= ultima; f++) indices.push(f)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex h-5 items-center justify-between text-xs text-tinta-3">
        <span>Toda la secuencia, de la posición 0 a la {entero(Math.max(0, secuencia.length - 1))}. Haz clic en la franja para saltar.</span>
        <span className="mono cifras text-tinta-2" aria-live="off">
          {senalada !== null && letraSenalada
            ? `posición ${entero(senalada)} · ${letraSenalada}${esBaseValida(letraSenalada) ? '' : ` (${SIGNIFICADO_IUPAC[letraSenalada] ?? 'ambigua'})`}`
            : ''}
        </span>
      </div>

      <div
        ref={mapa}
        className="relative mb-3 h-[18px] shrink-0 cursor-pointer overflow-hidden rounded-[3px]"
        onClick={(e) => {
          const caja = e.currentTarget.getBoundingClientRect()
          irA(Math.floor(((e.clientX - caja.left) / caja.width) * secuencia.length))
        }}
      >
        <canvas ref={lienzo} className="block h-full w-full opacity-70" aria-hidden />
        {ambiguas.map((a) => (
          <span key={a.pos} className="absolute top-0 h-full w-0.5 bg-hueso" style={{ left: `${(a.pos / secuencia.length) * 100}%` }} />
        ))}
        <div
          className="pointer-events-none absolute top-0 h-full rounded-[3px] border-2 border-hueso bg-hueso/15"
          style={{ left: `${(primeraVisible / secuencia.length) * 100}%`, width: `${Math.min(100, (visibles / secuencia.length) * 100)}%` }}
        />
      </div>

      <div
        ref={ventana}
        id="secuencia"
        onScroll={(e) => setDesplazamiento(e.currentTarget.scrollTop)}
        onMouseOver={(e) => {
          const pos = (e.target as HTMLElement).dataset?.pos
          setSenalada(pos === undefined ? null : Number(pos))
        }}
        onMouseLeave={() => setSenalada(null)}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-linea bg-superficie py-2"
      >
        <div className="relative" style={{ height: filas * ALTO_FILA }}>
          {ancho > 0 &&
            indices.map((f) => {
              const inicio = f * porFila
              const enEstaFila = resaltada !== null && resaltada >= inicio && resaltada < inicio + porFila ? resaltada : null
              return <Fila key={f} secuencia={secuencia} inicio={inicio} porFila={porFila} resaltada={enEstaFila} />
            })}
        </div>
      </div>
    </div>
  )
}
