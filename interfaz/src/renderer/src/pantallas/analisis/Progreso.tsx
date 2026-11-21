import { motion } from 'motion/react'
import { LoaderCircle } from 'lucide-react'
import { entero } from '@/lib/formato'
import { PROCESOS_A_LA_VEZ } from '@/motor/lote'

interface Props {
  /** Qué está haciendo el motor ("Comparando A.FR… con cada virus"). */
  titulo: string
  hechos: number
  total: number
  /** Qué se cuenta ("comparaciones", "virus contados"…). */
  unidad: string
}

/** Barra de avance mientras el motor responde un lote de pedidos. */
export function Progreso({ titulo, hechos, total, unidad }: Props) {
  const fraccion = total > 0 ? hechos / total : 0
  return (
    <div className="grid h-full place-items-center px-8" role="status" aria-live="polite">
      <div className="w-full max-w-lg rounded-xl border border-linea bg-superficie px-6 py-5" data-progreso={`${hechos}/${total}`}>
        <div className="flex items-center gap-3">
          <LoaderCircle size={18} className="shrink-0 animate-spin text-tinta-3" />
          <span className="min-w-0 flex-1 text-sm text-tinta">{titulo}</span>
          <span className="mono cifras shrink-0 text-xs text-tinta-2">{Math.floor(fraccion * 100)} %</span>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-superficie-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={hechos}
          aria-label={titulo}
        >
          <motion.div className="h-full rounded-full bg-fluor-4" initial={false} animate={{ width: `${fraccion * 100}%` }} transition={{ duration: 0.25, ease: 'easeOut' }} />
        </div>
        <div className="mt-2.5 flex justify-between text-xs text-tinta-3">
          <span>
            <span className="mono cifras text-tinta-2">{entero(hechos)}</span> de <span className="mono cifras">{entero(total)}</span> {unidad}
          </span>
          <span>{PROCESOS_A_LA_VEZ} procesos del motor a la vez</span>
        </div>
      </div>
    </div>
  )
}
