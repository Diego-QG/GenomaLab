// Dibujo de una tabla de k-mers: en DOM si es chica (64 casillas), en canvas si
// es grande (4096). Las dos muestran el camino de saltos de la inserción actual.

import { memo, useEffect, useRef } from 'react'
import type { ResultadoSalto, SaltoKmer } from '@compartido/contrato'
import { COLOR_BASE, COLOR_AMBIGUA, escalaFluor } from '@/lib/colores'
import { clases } from '@/lib/formato'
import { useMedida } from '@/lib/useMedida'

export interface DatosTabla {
  tamano: number
  kmers: readonly (string | null)[]
  conteos: ArrayLike<number>
  /** Casillas visitadas por la inserción en curso. */
  camino?: readonly SaltoKmer[]
  resultado?: ResultadoSalto | null
  destino?: number
  /** Pintar cada casilla según su conteo (vista de la tabla final). */
  calor?: boolean
}

const ROJO = '#e5433d'
const VERDE = '#31e4ac'
const HUESO = '#f3efe4'

function maximoDe(conteos: ArrayLike<number>): number {
  let m = 0
  for (let i = 0; i < conteos.length; i++) if (conteos[i] > m) m = conteos[i]
  return m
}

// ── Tabla chica (DOM) ────────────────────────────────────────────────────────

type EstadoCelda = 'normal' | 'colision' | 'nuevo' | 'sumado'

interface PropsCelda {
  pos: number
  kmer: string | null
  conteo: number
  estado: EstadoCelda
  fondo: string | undefined
  /** Con fondo de calor: true = casilla oscura, la letra va clara. */
  tintaClara: boolean
}

const Celda = memo(function Celda({ pos, kmer, conteo, estado, fondo, tintaClara }: PropsCelda) {
  const conCalor = fondo !== undefined && estado === 'normal'
  const tintaDeCalor = tintaClara ? '#eceef6' : '#0b0c14'
  return (
    <div
      data-celda={pos}
      data-estado={estado}
      title={kmer === null ? `Casilla ${pos}: libre` : `Casilla ${pos}: ${kmer} × ${conteo}`}
      className={clases(
        'relative flex aspect-[5/6] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[4px] border transition-colors duration-150',
        estado === 'normal' && (kmer === null ? 'border-linea/70' : 'border-linea bg-superficie-2'),
        estado === 'colision' && 'z-10 border-mal bg-mal/25',
        estado === 'nuevo' && 'z-10 animate-destello border-bien bg-bien/25',
        estado === 'sumado' && 'z-10 animate-destello border-hueso bg-hueso/20',
      )}
      style={conCalor ? { background: fondo, borderColor: 'transparent', color: tintaDeCalor } : undefined}
    >
      {kmer !== null && (
        <>
          <span className="mono flex text-[0.58rem] font-bold leading-none">
            {[...kmer].map((letra, i) => (
              <span key={i} className="px-px" style={conCalor ? undefined : { color: COLOR_BASE[letra] ?? COLOR_AMBIGUA }}>
                {letra}
              </span>
            ))}
          </span>
          <span className={clases('mono cifras text-[0.6rem] leading-none', conCalor ? 'font-bold' : 'text-tinta')}>{conteo}</span>
        </>
      )}
    </div>
  )
})

/** Tabla de hasta unos cientos de casillas, con el k-mer y su conteo en cada una. */
export function TablaChica({ tamano, kmers, conteos, camino = [], resultado = null, destino = -1, calor = false, columnas }: DatosTabla & { columnas: number }) {
  const filas = Math.ceil(tamano / columnas)
  const escala = calor ? escalaFluor(maximoDe(conteos)) : null
  const maximo = calor ? maximoDe(conteos) : 0

  const estados = new Map<number, EstadoCelda>()
  for (const salto of camino) if (salto.resultado === 'colision') estados.set(salto.pos, 'colision')
  if (destino >= 0 && (resultado === 'nuevo' || resultado === 'sumado')) estados.set(destino, resultado)

  // Línea que une las casillas visitadas (en unidades de casilla)
  const puntos: string[] = []
  let previa = -2
  for (const salto of camino) {
    const x = (salto.pos % columnas) + 0.5
    const y = Math.floor(salto.pos / columnas) + 0.5
    // Un salto +1 que cambia de fila no se dibuja como diagonal: corta la línea
    const cambiaDeFila = previa >= 0 && salto.pos === previa + 1 && Math.floor(previa / columnas) !== Math.floor(salto.pos / columnas)
    puntos.push(`${puntos.length === 0 || cambiaDeFila ? 'M' : 'L'}${x} ${y}`)
    previa = salto.pos
  }

  const celdas = []
  for (let pos = 0; pos < tamano; pos++) {
    const conteo = conteos[pos]
    celdas.push(
      <Celda
        key={pos}
        pos={pos}
        kmer={kmers[pos]}
        conteo={conteo}
        estado={estados.get(pos) ?? 'normal'}
        fondo={escala && kmers[pos] !== null ? escala(conteo) : undefined}
        tintaClara={maximo > 0 && conteo / maximo < 0.62}
      />,
    )
  }

  return (
    <div className="relative">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
        {celdas}
      </div>
      {puntos.length > 1 && (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox={`0 0 ${columnas} ${filas}`} preserveAspectRatio="none" aria-hidden>
          <path d={puntos.join(' ')} fill="none" stroke={HUESO} strokeWidth={1.5} strokeOpacity={0.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  )
}

// ── Tabla grande (canvas) ────────────────────────────────────────────────────

/** Tabla de miles de casillas: un cuadradito por casilla, pintado según su conteo. */
export function TablaGrande({
  tamano,
  kmers,
  conteos,
  camino = [],
  resultado = null,
  destino = -1,
  columnas,
  alSenalar,
}: DatosTabla & { columnas: number; alSenalar?: (pos: number | null) => void }) {
  const caja = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const { ancho } = useMedida(caja)
  const filas = Math.ceil(tamano / columnas)
  const lado = ancho > 0 ? ancho / columnas : 0
  const alto = lado * filas

  useEffect(() => {
    const canvas = lienzo.current
    if (!canvas || ancho === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(ancho * dpr)
    canvas.height = Math.round(alto * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#161829'
    ctx.fillRect(0, 0, ancho, alto)

    const escala = escalaFluor(Math.max(4, maximoDe(conteos)))
    const hueco = lado > 3 ? 0.6 : 0.25
    for (let pos = 0; pos < tamano; pos++) {
      if (kmers[pos] === null) continue
      ctx.fillStyle = escala(Math.max(1.5, conteos[pos]))
      ctx.fillRect((pos % columnas) * lado + hueco / 2, Math.floor(pos / columnas) * lado + hueco / 2, lado - hueco, lado - hueco)
    }

    // Camino de la inserción en curso
    const centro = (pos: number): [number, number] => [(pos % columnas) * lado + lado / 2, Math.floor(pos / columnas) * lado + lado / 2]
    if (camino.length > 1) {
      ctx.strokeStyle = HUESO
      ctx.globalAlpha = 0.7
      ctx.lineWidth = 1.25
      ctx.beginPath()
      camino.forEach((salto, i) => {
        const [x, y] = centro(salto.pos)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    const marca = Math.max(lado * 2.4, 7)
    for (const salto of camino) {
      if (salto.resultado !== 'colision') continue
      const [x, y] = centro(salto.pos)
      ctx.fillStyle = ROJO
      ctx.fillRect(x - marca / 2, y - marca / 2, marca, marca)
    }
    if (destino >= 0 && (resultado === 'nuevo' || resultado === 'sumado')) {
      const [x, y] = centro(destino)
      ctx.fillStyle = resultado === 'nuevo' ? VERDE : HUESO
      ctx.fillRect(x - marca / 2 - 1, y - marca / 2 - 1, marca + 2, marca + 2)
    }
  }, [ancho, alto, lado, tamano, columnas, kmers, conteos, camino, resultado, destino])

  return (
    <div ref={caja} className="overflow-hidden rounded-md" style={{ height: alto || undefined }}>
      <canvas
        ref={lienzo}
        className="block"
        style={{ width: ancho, height: alto }}
        onMouseMove={
          alSenalar &&
          ((e) => {
            const caja = e.currentTarget.getBoundingClientRect()
            const columna = Math.floor((e.clientX - caja.left) / lado)
            const fila = Math.floor((e.clientY - caja.top) / lado)
            const pos = fila * columnas + columna
            alSenalar(pos >= 0 && pos < tamano ? pos : null)
          })
        }
        onMouseLeave={alSenalar && (() => alSenalar(null))}
        role="img"
        aria-label={`Tabla de ${tamano} casillas`}
      />
    </div>
  )
}
