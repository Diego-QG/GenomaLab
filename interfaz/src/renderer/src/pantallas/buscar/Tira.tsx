import { AnimatePresence, motion } from 'motion/react'
import { Check, X } from 'lucide-react'
import { clases } from '@/lib/formato'

export type EstadoCasilla = 'sin-visitar' | 'distinta' | 'igual' | 'vacia-final'

const ANCHO = 156
const ALTO = 78
const VECINAS = 5 // casillas a cada lado de la activa

interface Props {
  tamano: number
  /** ID guardado en cada casilla ocupada. */
  ocupadas: ReadonlyMap<number, string>
  /** Casilla sobre la que está la lupa. */
  centro: number
  /** Resultado de cada casilla ya comparada. */
  visitadas: ReadonlyMap<number, EstadoCasilla>
  /** false = la tabla todavía no participa (se muestra atenuada). */
  activa: boolean
}

/**
 * La tabla como una tira de casillas, ampliada alrededor de la casilla activa.
 * La tira se desliza para dejar siempre la casilla activa en el centro.
 */
export function Tira({ tamano, ocupadas, centro, visitadas, activa }: Props) {
  const casillas = []
  for (let d = -VECINAS; d <= VECINAS; d++) {
    if (tamano <= 2 * VECINAS && (d < -Math.floor((tamano - 1) / 2) || d > Math.floor(tamano / 2))) continue
    const pos = (((centro + d) % tamano) + tamano) % tamano
    casillas.push({ pos, d })
  }

  return (
    <div
      className={clases('relative overflow-hidden transition-opacity duration-300', !activa && 'opacity-40')}
      style={{
        height: ALTO + 8,
        maskImage: 'linear-gradient(to right, transparent, black 14%, black 86%, transparent)',
      }}
    >
      <AnimatePresence initial={false}>
        {casillas.map(({ pos, d }) => {
          const id = ocupadas.get(pos)
          const estado = visitadas.get(pos) ?? 'sin-visitar'
          const esCentro = d === 0 && activa
          return (
            <motion.div
              key={pos}
              className="absolute left-1/2 top-1"
              style={{ width: ANCHO, height: ALTO, marginLeft: -ANCHO / 2 }}
              initial={{ x: d * ANCHO + Math.sign(d) * ANCHO, opacity: 0 }}
              animate={{ x: d * ANCHO, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 210, damping: 27 }}
            >
              <div
                data-casilla={pos}
                data-estado={estado}
                className={clases(
                  'relative mx-1 flex h-full flex-col rounded-lg border px-2.5 py-2 transition-colors duration-200',
                  estado === 'igual' && 'border-bien bg-bien/15 shadow-[0_0_28px_-6px_var(--color-bien)]',
                  estado === 'distinta' && 'border-mal/80 bg-mal/10',
                  estado === 'vacia-final' && 'border-hueso bg-hueso/8',
                  estado === 'sin-visitar' && (id === undefined ? 'border-dashed border-linea-fuerte' : 'border-linea bg-superficie'),
                  esCentro && estado === 'sin-visitar' && 'border-hueso',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={clases('mono cifras text-xs', esCentro ? 'font-bold text-tinta' : 'text-tinta-3')}>{pos}</span>
                  {estado === 'igual' && (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-bien text-fondo">
                      <Check size={13} strokeWidth={3.5} />
                    </span>
                  )}
                  {estado === 'distinta' && (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-mal text-fondo">
                      <X size={13} strokeWidth={3.5} />
                    </span>
                  )}
                </div>
                <div className="flex min-h-0 flex-1 items-center">
                  {id === undefined ? (
                    <span className="text-xs text-tinta-3">vacía</span>
                  ) : (
                    <span className={clases('mono select-text break-all text-[0.66rem] leading-[1.35]', estado === 'sin-visitar' ? 'text-tinta-2' : 'text-tinta')}>
                      {id}
                    </span>
                  )}
                </div>
              </div>

              {/* El salto +1 hacia la casilla siguiente */}
              {estado === 'distinta' && (
                <motion.div
                  className="mono pointer-events-none absolute -top-0.5 left-full z-10 -ml-4 rounded-full bg-mal px-1.5 text-2xs font-bold text-fondo"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 22 }}
                >
                  +1
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
