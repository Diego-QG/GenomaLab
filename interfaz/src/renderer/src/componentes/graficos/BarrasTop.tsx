import { motion } from 'motion/react'
import type { ParKmer } from '@compartido/contrato'
import { Kmer } from '@/componentes/Base'
import { entero } from '@/lib/formato'

interface Props {
  datos: readonly ParKmer[]
  /** Cuántas barras mostrar (el resto se ve como hueco pendiente). Por defecto, todas. */
  visibles?: number
  /** Total de filas reservadas, para que el gráfico no cambie de alto mientras se llena. */
  filas?: number
}

/**
 * Barras horizontales del top n de k-mers. Una sola serie: todas las barras del
 * mismo color; el nombre a la izquierda y el valor en la punta.
 */
export function BarrasTop({ datos, visibles = datos.length, filas = datos.length }: Props) {
  const maximo = datos.reduce((m, d) => Math.max(m, d.conteo), 0) || 1
  const k = datos[0]?.kmer.length ?? 3
  const lista = []
  for (let i = 0; i < filas; i++) {
    const dato = i < visibles ? datos[i] : undefined
    lista.push(
      <li key={i} className="flex h-6 items-center gap-2.5" title={dato ? `${dato.kmer}: ${entero(dato.conteo)} veces` : undefined}>
        <span className="mono cifras w-5 shrink-0 text-right text-2xs text-tinta-3">{i + 1}</span>
        <span className="shrink-0" style={{ width: `${k * 1.05}rem` }}>
          {dato ? <Kmer texto={dato.kmer} tamano="s" /> : <span className="block h-5 rounded-[3px] border border-dashed border-linea" />}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {dato && (
            <>
              <motion.div
                className="h-3.5 rounded-r-[4px] bg-fluor-4"
                initial={{ width: 0 }}
                animate={{ width: `${(dato.conteo / maximo) * 84}%` }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
              <span className="mono cifras text-xs text-tinta">{entero(dato.conteo)}</span>
            </>
          )}
        </div>
      </li>,
    )
  }
  return <ol className="space-y-1">{lista}</ol>
}
