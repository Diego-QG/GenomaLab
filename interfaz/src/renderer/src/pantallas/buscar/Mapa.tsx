import { memo } from 'react'
import { clases } from '@/lib/formato'
import type { EstadoCasilla } from './Tira'

interface PropsCelda {
  pos: number
  id: string | undefined
  estado: EstadoCasilla
  esInicio: boolean
  esActual: boolean
  alElegir: (id: string) => void
}

const Celda = memo(function Celda({ pos, id, estado, esInicio, esActual, alElegir }: PropsCelda) {
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={id === undefined}
      onClick={id === undefined ? undefined : () => alElegir(id)}
      title={id === undefined ? `Casilla ${pos}: vacía` : `Casilla ${pos}: ${id}\n(clic para buscar este ID)`}
      className={clases(
        'h-[7px] w-[7px] rounded-[2px] transition-colors duration-200',
        estado === 'igual' && 'bg-bien',
        estado === 'distinta' && 'bg-mal',
        estado === 'vacia-final' && 'bg-hueso',
        estado === 'sin-visitar' && (id === undefined ? 'bg-superficie-2' : 'bg-tinta-3/70 hover:bg-tinta'),
        esInicio && estado === 'sin-visitar' && 'bg-hueso',
        esActual && 'outline outline-2 outline-offset-1 outline-hueso',
      )}
    />
  )
})

interface Props {
  tamano: number
  ocupadas: ReadonlyMap<number, string>
  visitadas: ReadonlyMap<number, EstadoCasilla>
  /** Casilla donde empezó la búsqueda (null = todavía no se sabe). */
  inicio: number | null
  /** Casilla que se está comparando ahora. */
  actual: number | null
  alElegir: (id: string) => void
}

/**
 * Toda la tabla de un vistazo: un cuadradito por casilla. Las ocupadas se ven
 * llenas, así que los amontonamientos del sondeo lineal saltan a la vista.
 */
export function Mapa({ tamano, ocupadas, visitadas, inicio, actual, alElegir }: Props) {
  const celdas = []
  for (let pos = 0; pos < tamano; pos++) {
    celdas.push(
      <Celda
        key={pos}
        pos={pos}
        id={ocupadas.get(pos)}
        estado={visitadas.get(pos) ?? 'sin-visitar'}
        esInicio={pos === inicio}
        esActual={pos === actual}
        alElegir={alElegir}
      />,
    )
  }
  return (
    <div className="flex flex-wrap gap-0.5" role="img" aria-label={`Mapa de las ${tamano} casillas de la tabla`}>
      {celdas}
    </div>
  )
}
