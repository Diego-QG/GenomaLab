import { memo, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { TriangleAlert } from 'lucide-react'
import type { VirusResumen } from '@compartido/contrato'
import { CodigoDeBarras } from '@/componentes/CodigoDeBarras'
import { ChipGrupo } from '@/componentes/ui'
import { decimal, entero } from '@/lib/formato'
import { useMedida } from '@/lib/useMedida'

const ANCHO_MINIMO = 252
const ALTO = 104
const HUECO = 12
const RELLENO = 13 // borde + relleno interior de la tarjeta, por lado

interface PropsTarjeta {
  virus: VirusResumen
  x: number
  y: number
  ancho: number
  /** Posición desde la que entra volando (solo al llegar desde Inicio). */
  origen: { x: number; y: number } | null
  orden: number
  alAbrir: (id: string) => void
}

const Tarjeta = memo(function Tarjeta({ virus, x, y, ancho, origen, orden, alAbrir }: PropsTarjeta) {
  return (
    <motion.button
      type="button"
      data-tarjeta={virus.id}
      onClick={() => alAbrir(virus.id)}
      title={`Abrir ${virus.id}`}
      className="absolute left-0 top-0 flex flex-col justify-between rounded-lg border border-linea bg-superficie px-3 py-2.5 text-left hover:border-tinta-3 hover:bg-superficie-2"
      style={{ width: ancho, height: ALTO }}
      initial={origen ? { x: origen.x, y: origen.y, opacity: 0, scale: 0.25 } : { x, y, opacity: 0, scale: 0.94 }}
      animate={{ x, y, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
      transition={
        origen
          ? { type: 'spring', stiffness: 150, damping: 21, delay: 0.1 + orden * 0.022 }
          : { type: 'spring', stiffness: 380, damping: 36, opacity: { duration: 0.18 }, scale: { duration: 0.18 } }
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="mono min-w-0 truncate text-xs font-semibold text-tinta">{virus.id}</span>
        <ChipGrupo grupo={virus.grupo} />
      </div>
      <CodigoDeBarras id={virus.id} ancho={Math.floor(ancho - RELLENO * 2)} />
      <div className="cifras flex items-center gap-4 text-xs text-tinta-2">
        <span>{entero(virus.longitud)} bases</span>
        <span>GC {decimal(virus.gc, 1)} %</span>
        {virus.ambiguas > 0 && (
          <span className="ml-auto flex items-center gap-1 text-tinta-3" title={`${virus.ambiguas} bases ambiguas (R, Y, N…)`}>
            <TriangleAlert size={12} />
            {virus.ambiguas}
          </span>
        )}
      </div>
    </motion.button>
  )
})

interface Props {
  virus: VirusResumen[]
  alAbrir: (id: string) => void
  /** true durante la llegada desde Inicio: las tarjetas entran volando desde el centro. */
  entrada: boolean
}

/**
 * Cuadrícula virtualizada: solo existen en el DOM las tarjetas visibles. Cada una
 * tiene su posición calculada, así que al filtrar u ordenar se deslizan a su nuevo
 * sitio (animación de layout) en vez de saltar.
 */
export function Rejilla({ virus, alAbrir, entrada }: Props) {
  const ventana = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLDivElement>(null)
  const { alto: altoVentana } = useMedida(ventana)
  const { ancho } = useMedida(lienzo)
  const [desplazamiento, setDesplazamiento] = useState(0)

  // Al cambiar el filtro, de vuelta arriba
  const firma = virus.length > 0 ? `${virus.length}:${virus[0].id}` : '0'
  useEffect(() => {
    ventana.current?.scrollTo({ top: 0 })
    setDesplazamiento(0)
  }, [firma])

  const columnas = Math.max(1, Math.floor((ancho + HUECO) / (ANCHO_MINIMO + HUECO)))
  const anchoTarjeta = ancho > 0 ? (ancho - HUECO * (columnas - 1)) / columnas : ANCHO_MINIMO
  const pasoFila = ALTO + HUECO
  const filas = Math.ceil(virus.length / columnas)
  const primeraFila = Math.max(0, Math.floor(desplazamiento / pasoFila) - 1)
  const ultimaFila = Math.min(filas - 1, Math.floor((desplazamiento + altoVentana) / pasoFila) + 1)
  const desde = primeraFila * columnas
  const visibles = ancho > 0 ? virus.slice(desde, (ultimaFila + 1) * columnas) : []

  // Las tarjetas salen de donde estaba la hélice en Inicio (a la derecha del centro)
  const centro = { x: ancho * 0.64 - anchoTarjeta / 2, y: desplazamiento + altoVentana / 2 - ALTO / 2 - 60 }

  return (
    <div ref={ventana} onScroll={(e) => setDesplazamiento(e.currentTarget.scrollTop)} className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1">
      <div ref={lienzo} className="relative" style={{ height: Math.max(0, filas * pasoFila - HUECO) }}>
        <AnimatePresence initial={entrada}>
          {visibles.map((v, k) => {
            const indice = desde + k
            return (
              <Tarjeta
                key={v.id}
                virus={v}
                x={(indice % columnas) * (anchoTarjeta + HUECO)}
                y={Math.floor(indice / columnas) * pasoFila}
                ancho={anchoTarjeta}
                origen={entrada ? centro : null}
                orden={k}
                alAbrir={alAbrir}
              />
            )
          })}
        </AnimatePresence>
        {virus.length === 0 && ancho > 0 && (
          <p className="pt-16 text-center text-tinta-3">Ningún virus coincide con el filtro. Borra la búsqueda o elige otro grupo.</p>
        )}
      </div>
    </div>
  )
}
