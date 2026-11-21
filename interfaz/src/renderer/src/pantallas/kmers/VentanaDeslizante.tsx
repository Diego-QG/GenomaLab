import { Base } from '@/componentes/Base'
import { entero } from '@/lib/formato'

const PASO = 26 // ancho de una base (24) + hueco (2)
const ANTES = 30
const DESPUES = 34

interface Props {
  secuencia: string
  /** Posición donde empieza la ventana actual. */
  ventana: number
  k: number
  /** Cuántas ventanas tiene la secuencia en total. */
  totalVentanas: number
}

/**
 * La secuencia con una ventana de k letras que avanza de una en una.
 * La ventana se queda en el centro y la secuencia se desliza por debajo.
 */
export function VentanaDeslizante({ secuencia, ventana, k, totalVentanas }: Props) {
  const desde = Math.max(0, ventana - ANTES)
  const hasta = Math.min(secuencia.length, ventana + k + DESPUES)
  const bases = []
  for (let i = desde; i < hasta; i++) {
    const dentro = i >= ventana && i < ventana + k
    bases.push(
      <span key={i} className="absolute top-0" style={{ left: i * PASO }}>
        <Base letra={secuencia[i]} tamano="m" apagada={!dentro} />
      </span>,
    )
  }
  const anchoVentana = k * PASO + 6

  return (
    <div className="relative h-[4.6rem] overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)' }}>
      <div className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-center text-xs text-tinta-2">
        ventana <span className="mono cifras font-semibold text-tinta">{entero(ventana + 1)}</span> de {entero(totalVentanas)}
      </div>

      {/* La secuencia: se desplaza para que la ventana quede en el centro */}
      <div
        className="absolute left-1/2 top-[1.6rem] h-7 transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${-(ventana + k / 2) * PASO + 1}px)` }}
      >
        {bases}
      </div>

      {/* El marco de la ventana, fijo en el centro */}
      <div
        className="pointer-events-none absolute left-1/2 top-[1.35rem] h-9 -translate-x-1/2 rounded-md border-2 border-hueso shadow-[0_0_18px_-4px_var(--color-hueso)]"
        style={{ width: anchoVentana }}
      />
      <div className="mono cifras absolute left-1/2 top-[3.75rem] -translate-x-1/2 whitespace-nowrap text-2xs text-tinta-3">
        posiciones {entero(ventana)} a {entero(ventana + k - 1)}
      </div>
    </div>
  )
}
