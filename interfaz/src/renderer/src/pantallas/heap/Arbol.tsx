import { useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ParKmer } from '@compartido/contrato'
import { COLOR_AMBIGUA, COLOR_BASE, escalaFluor } from '@/lib/colores'
import { clases } from '@/lib/formato'
import { useMedida } from '@/lib/useMedida'
import { nivelDe } from './modelo'

const RADIO_MAXIMO = 23
const MARGEN_SUPERIOR = 8

export type Realce = 'intercambio' | 'nuevo' | null

interface Props {
  arreglo: readonly ParKmer[]
  /** Índices implicados en el cuadro actual. */
  activos: readonly number[]
  realce: Realce
  /** Cuántos niveles del árbol se dibujan. */
  niveles: number
  /** Conteo más alto que pasará por el heap (escala de color). */
  maximo: number
  /** K-mer que acaba de salir del heap en este cuadro (su nodo se va volando). */
  extraido: string | null
}

/**
 * El heap como árbol binario: el elemento i tiene a sus hijos en 2i + 1 y 2i + 2.
 * Cada nodo se identifica por su k-mer, así que al intercambiarse dos elementos
 * los nodos viajan de un sitio al otro.
 */
export function Arbol({ arreglo, activos, realce, niveles, maximo, extraido }: Props) {
  const caja = useRef<HTMLDivElement>(null)
  const { ancho, alto } = useMedida(caja)
  const escala = useMemo(() => escalaFluor(maximo), [maximo])

  const visibles = Math.min(arreglo.length, 2 ** niveles - 1)
  const altoNivel = niveles > 1 ? Math.max(30, (alto - 2 * RADIO_MAXIMO - MARGEN_SUPERIOR - 18) / (niveles - 1)) : 0

  const geometria = (indice: number): { x: number; y: number; r: number } => {
    const nivel = nivelDe(indice)
    const enNivel = indice - (2 ** nivel - 1)
    const separacion = ancho / 2 ** nivel
    return {
      x: (enNivel + 0.5) * separacion,
      y: MARGEN_SUPERIOR + RADIO_MAXIMO + nivel * altoNivel,
      r: Math.max(8, Math.min(RADIO_MAXIMO, separacion / 2 - 2.5)),
    }
  }

  const lineas = []
  if (ancho > 0) {
    for (let i = 1; i < visibles; i++) {
      const hijo = geometria(i)
      const padreIndice = Math.floor((i - 1) / 2)
      const padre = geometria(padreIndice)
      const enJuego = realce === 'intercambio' && activos.includes(i) && activos.includes(padreIndice)
      lineas.push(
        <line
          key={i}
          x1={padre.x}
          y1={padre.y}
          x2={hijo.x}
          y2={hijo.y}
          stroke={enJuego ? 'var(--color-hueso)' : 'var(--color-linea-fuerte)'}
          strokeWidth={enJuego ? 2.5 : 1.25}
        />,
      )
    }
  }

  return (
    <div ref={caja} className="relative h-full min-h-0 w-full overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {lineas}
      </svg>
      {ancho > 0 && (
        <AnimatePresence initial={false} custom={extraido}>
          {arreglo.slice(0, visibles).map((par, indice) => {
            const { x, y, r } = geometria(indice)
            const activo = activos.includes(indice)
            const fondo = escala(par.conteo)
            const oscuro = maximo > 0 && par.conteo / maximo < 0.62
            // El nombre va debajo del nodo si hay sitio antes del nivel siguiente (o si es el último nivel)
            const ultimoNivel = nivelDe(indice) === niveles - 1
            const hayHueco = ultimoNivel || altoNivel - 2 * r >= 15
            const conEtiqueta = (r >= 17 && hayHueco) || (activo && r >= 8)
            return (
              <motion.div
                key={par.kmer}
                data-nodo={indice}
                title={`Índice ${indice}: ${par.kmer} aparece ${par.conteo} veces`}
                className={clases(
                  'absolute left-0 top-0 grid place-items-center rounded-full',
                  activo && realce === 'intercambio' && 'z-20 shadow-[0_0_0_3px_var(--color-hueso),0_0_22px_2px_var(--color-hueso)]',
                  activo && realce === 'nuevo' && 'z-20 shadow-[0_0_0_3px_var(--color-bien),0_0_22px_2px_var(--color-bien)]',
                )}
                style={{ background: fondo, color: oscuro ? '#eceef6' : '#0b0c14' }}
                initial={{ x: x - r, y: y - r + 26, width: 2 * r, height: 2 * r, opacity: 0, scale: 0.4 }}
                animate={{ x: x - r, y: y - r, width: 2 * r, height: 2 * r, opacity: 1, scale: 1 }}
                variants={{
                  // El que sale como máximo se va volando hacia el top; los demás solo se desvanecen
                  salir: (kmerExtraido: string | null) =>
                    kmerExtraido === par.kmer
                      ? { x: ancho - 2 * r, y: -2 * r - 10, opacity: 0, scale: 0.7, transition: { duration: 0.45, ease: [0.5, 0, 0.75, 0] as const } }
                      : { opacity: 0, scale: 0.5, transition: { duration: 0.18 } },
                }}
                exit="salir"
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              >
                {r >= 8 && (
                  <span className={clases('mono cifras font-bold leading-none', r >= 18 ? 'text-xs' : r >= 13 ? 'text-[0.62rem]' : 'text-[0.5rem]')}>
                    {par.conteo}
                  </span>
                )}
                {conEtiqueta && (
                  <span className="mono pointer-events-none absolute left-1/2 top-full z-30 mt-0.5 flex -translate-x-1/2 rounded bg-fondo/85 px-1 text-[0.62rem] font-bold leading-tight">
                    {[...par.kmer].map((letra, i) => (
                      <span key={i} style={{ color: COLOR_BASE[letra] ?? COLOR_AMBIGUA }}>
                        {letra}
                      </span>
                    ))}
                  </span>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      )}
      {arreglo.length > visibles && (
        <div className="absolute bottom-0 left-0 text-xs text-tinta-3">
          Se dibujan los {niveles} primeros niveles ({visibles} nodos). Hay {arreglo.length - visibles} más en los niveles de abajo.
        </div>
      )}
    </div>
  )
}
