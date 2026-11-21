// La casilla de una base: el mismo dibujo en secuencias, k-mers y parejas.

import type { CSSProperties } from 'react'
import { COLOR_AMBIGUA, TINTA_SOBRE_BASE, colorDeBase, esBaseValida } from '@/lib/colores'
import { clases } from '@/lib/formato'

const TAMANOS = {
  xs: 'h-4 w-3.5 text-[0.6rem] rounded-[2px]',
  s: 'h-5 w-4 text-[0.68rem] rounded-[3px]',
  m: 'h-7 w-6 text-sm rounded-[4px]',
  l: 'h-10 w-9 text-xl rounded-md',
} as const

export type TamanoBase = keyof typeof TAMANOS

interface PropsBase {
  letra: string
  tamano?: TamanoBase
  /** Atenuada: se ve la letra pero sin el color lleno. */
  apagada?: boolean
  className?: string
  style?: CSSProperties
}

export function Base({ letra, tamano = 'm', apagada = false, className, style }: PropsBase) {
  const valida = esBaseValida(letra)
  const color = valida ? colorDeBase(letra) : COLOR_AMBIGUA
  return (
    <span
      className={clases(
        'mono inline-grid shrink-0 place-items-center font-bold leading-none',
        TAMANOS[tamano],
        !valida && !apagada && 'trama-ambigua',
        className,
      )}
      style={
        apagada
          ? { color, background: `color-mix(in oklab, ${color} 14%, transparent)`, ...style }
          : { color: TINTA_SOBRE_BASE, background: color, ...style }
      }
    >
      {letra}
    </span>
  )
}

/** Un k-mer (o una pareja de bases) como casillas de color pegadas. */
export function Kmer({ texto, tamano = 's', apagado = false, className }: { texto: string; tamano?: TamanoBase; apagado?: boolean; className?: string }) {
  return (
    <span className={clases('inline-flex shrink-0 gap-px align-middle', className)} aria-label={texto}>
      {[...texto].map((letra, i) => (
        <Base key={i} letra={letra} tamano={tamano} apagada={apagado} />
      ))}
    </span>
  )
}
