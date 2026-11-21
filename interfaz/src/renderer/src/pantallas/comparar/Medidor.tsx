import { useEffect, useState } from 'react'
import { animate, motion } from 'motion/react'
import { decimal } from '@/lib/formato'

const RADIO = 44
const GROSOR = 9
// Arco de 270°, abierto por abajo
const INICIO = 135
const BARRIDO = 270

function punto(grados: number): [number, number] {
  const rad = (grados * Math.PI) / 180
  return [Math.cos(rad) * RADIO, Math.sin(rad) * RADIO]
}

function arco(desde: number, hasta: number): string {
  const [x1, y1] = punto(desde)
  const [x2, y2] = punto(hasta)
  return `M ${x1} ${y1} A ${RADIO} ${RADIO} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

interface Props {
  titulo: string
  detalle: string
  /** Similitud coseno entre 0 y 1 (la calcula el motor). */
  valor: number
}

/**
 * Medidor de similitud: el arco se llena de 0 a 1 y el número sube con él.
 * La pista es un paso oscuro del mismo tono que el relleno.
 */
export function Medidor({ titulo, detalle, valor }: Props) {
  const [mostrado, setMostrado] = useState(0)
  const acotado = Math.max(0, Math.min(1, valor))

  useEffect(() => {
    const control = animate(0, valor, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: setMostrado })
    return () => control.stop()
  }, [valor])

  return (
    <div className="flex items-center gap-4" title={`${titulo}: similitud coseno ${decimal(valor, 4)}`}>
      <svg viewBox="-55 -55 110 100" className="h-24 w-[6.6rem] shrink-0" role="img" aria-label={`${titulo}: ${decimal(valor, 4)}`}>
        <path d={arco(INICIO, INICIO + BARRIDO)} fill="none" stroke="var(--color-fluor-2)" strokeWidth={GROSOR} strokeLinecap="round" />
        <motion.path
          key={valor}
          d={arco(INICIO, INICIO + BARRIDO)}
          fill="none"
          stroke="var(--color-fluor-5)"
          strokeWidth={GROSOR}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: acotado }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <text y={2} textAnchor="middle" dominantBaseline="middle" className="fill-tinta text-[1.05rem] font-bold" style={{ fontFamily: 'var(--font-sans)' }}>
          {decimal(mostrado * 100, 1)}
        </text>
        <text y={19} textAnchor="middle" className="fill-tinta-3 text-[0.55rem]">
          %
        </text>
      </svg>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-tinta">{titulo}</div>
        <div className="mt-0.5 text-xs leading-snug text-tinta-3">{detalle}</div>
        <div className="mono cifras mt-1 text-xs text-tinta-2">coseno = {decimal(valor, 4)}</div>
      </div>
    </div>
  )
}
