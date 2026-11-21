import { memo, type MouseEvent } from 'react'
import { COLOR_AMBIGUA, COLOR_BASE } from '@/lib/colores'
import { clases } from '@/lib/formato'

export interface CeldaSenalada {
  fila: number
  columna: number
}

interface Props {
  matriz: readonly (readonly number[])[]
  /** Nombres de filas y columnas (las 16 parejas: AA, AC, …, TT). */
  nombres: readonly string[]
  /** Valor → color (escala secuencial o divergente). */
  color: (valor: number) => string
  senalada: CeldaSenalada | null
  alSenalar: (celda: CeldaSenalada | null) => void
  /** Texto del tooltip de cada celda. */
  describir: (fila: number, columna: number, valor: number) => string
  etiquetaAccesible: string
  /** Celdas que deben destellar (por ejemplo, la que acaba de recibir un arco). */
  destello?: CeldaSenalada | null
}

function Nombre({ texto, vertical, activo }: { texto: string; vertical?: boolean; activo: boolean }) {
  return (
    <span
      className={clases('mono flex justify-center text-[0.62rem] font-bold leading-[1.05] transition-opacity', vertical && 'flex-col items-center', !activo && 'opacity-55')}
    >
      {[...texto].map((letra, i) => (
        <span key={i} style={{ color: COLOR_BASE[letra] ?? COLOR_AMBIGUA }}>
          {letra}
        </span>
      ))}
    </span>
  )
}

/**
 * Mapa de calor cuadrado (16 × 16): la fila es la pareja de origen y la columna
 * la de destino. Ocupa todo el ancho que le den.
 */
export const MapaDeCalor = memo(function MapaDeCalor({ matriz, nombres, color, senalada, alSenalar, describir, etiquetaAccesible, destello }: Props) {
  const n = nombres.length

  const alMover = (e: MouseEvent<HTMLDivElement>): void => {
    const datos = (e.target as HTMLElement).dataset
    if (datos.f === undefined || datos.c === undefined) return
    const fila = Number(datos.f)
    const columna = Number(datos.c)
    if (senalada?.fila !== fila || senalada.columna !== columna) alSenalar({ fila, columna })
  }

  const celdas = []
  // Esquina vacía + nombres de columna
  celdas.push(<span key="esquina" />)
  for (let c = 0; c < n; c++) {
    celdas.push(
      <span key={`c${c}`} className="pb-1">
        <Nombre texto={nombres[c]} vertical activo={senalada === null || senalada.columna === c} />
      </span>,
    )
  }
  for (let f = 0; f < n; f++) {
    celdas.push(
      <span key={`f${f}`} className="flex items-center pr-1.5">
        <Nombre texto={nombres[f]} activo={senalada === null || senalada.fila === f} />
      </span>,
    )
    for (let c = 0; c < n; c++) {
      const valor = matriz[f]?.[c] ?? 0
      const activa = senalada?.fila === f && senalada.columna === c
      const conDestello = destello?.fila === f && destello.columna === c
      celdas.push(
        <div
          key={`${f}-${c}`}
          data-f={f}
          data-c={c}
          title={describir(f, c, valor)}
          className={clases('aspect-square rounded-[2px]', activa && 'relative z-10 outline outline-2 outline-hueso', conDestello && 'relative z-10 animate-destello outline outline-2 outline-hueso')}
          style={{ background: color(valor) }}
        />,
      )
    }
  }

  return (
    <div
      role="img"
      aria-label={etiquetaAccesible}
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `auto repeat(${n}, minmax(0, 1fr))` }}
      onMouseMove={alMover}
      onMouseLeave={() => alSenalar(null)}
    >
      {celdas}
    </div>
  )
})

/** Leyenda de una escala continua: una franja de color con sus extremos. */
export function LeyendaDeEscala({ colores, minimo, maximo, centro }: { colores: readonly string[]; minimo: string; maximo: string; centro?: string }) {
  return (
    <div className="flex items-center gap-2 text-2xs text-tinta-3">
      <span className="mono cifras">{minimo}</span>
      <span className="relative h-2 w-28 rounded-full" style={{ background: `linear-gradient(to right, ${colores.join(', ')})` }}>
        {centro !== undefined && <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 mono cifras">{centro}</span>}
      </span>
      <span className="mono cifras">{maximo}</span>
    </div>
  )
}
