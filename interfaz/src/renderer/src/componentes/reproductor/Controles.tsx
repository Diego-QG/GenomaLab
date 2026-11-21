import { useEffect, type ReactNode } from 'react'
import { Minus, Pause, Play, Plus, RotateCcw, StepBack, StepForward } from 'lucide-react'
import { clases } from '@/lib/formato'
import type { Reproductor } from './useReproductor'

interface Props {
  reproductor: Reproductor
  /** Texto que explica el paso actual (la "narración" de la animación). */
  narracion?: ReactNode
  /** Botones extra de la pantalla (por ejemplo, "Saltar a las extracciones"). */
  extra?: ReactNode
  /** Nombre de la unidad de avance, para la etiqueta ("paso", "inserción"…). */
  unidad?: string
}

function esCampoDeTexto(elemento: EventTarget | null): boolean {
  if (!(elemento instanceof HTMLElement)) return false
  return elemento.tagName === 'INPUT' || elemento.tagName === 'TEXTAREA' || elemento.tagName === 'SELECT' || elemento.isContentEditable
}

function BotonTransporte({
  etiqueta,
  atajo,
  onClick,
  deshabilitado,
  principal,
  children,
}: {
  etiqueta: string
  atajo: string
  onClick: () => void
  deshabilitado?: boolean
  principal?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      title={`${etiqueta} (${atajo})`}
      className={clases(
        'grid place-items-center rounded-full transition-colors duration-150 disabled:opacity-30',
        principal
          ? 'h-11 w-11 bg-hueso text-fondo hover:bg-white'
          : 'h-9 w-9 text-tinta-2 hover:bg-superficie-3 hover:text-tinta disabled:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Controles de reproducción: reiniciar, paso atrás, reproducir / pausa,
 * paso siguiente, barra de avance y velocidad. Atajos: Espacio, ← →, Inicio, + −.
 */
export function Controles({ reproductor: r, narracion, extra, unidad = 'paso' }: Props) {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent): void => {
      if (esCampoDeTexto(e.target) || e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === ' ') {
        // Si el foco quedó en un botón, Espacio también lo "pulsaría" al soltar la tecla
        // (y reproducir/pausa se anularía solo). Se le quita el foco antes.
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
        r.alternar()
      }
      else if (e.key === 'ArrowRight') r.siguiente()
      else if (e.key === 'ArrowLeft') r.anterior()
      else if (e.key === 'Home') r.reiniciar()
      else if (e.key === '+' || e.key === '=') r.masRapido()
      else if (e.key === '-') r.masLento()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [r])

  const ultimo = Math.max(0, r.total - 1)
  const avance = ultimo === 0 ? 0 : (r.paso / ultimo) * 100

  return (
    <div className="shrink-0 border-t border-linea bg-superficie/95 backdrop-blur" data-reproductor>
      {narracion !== undefined && (
        <div className="flex min-h-12 items-center border-b border-linea px-5 py-2 text-[0.95rem] leading-snug text-tinta" aria-live="polite">
          {narracion}
        </div>
      )}
      <div className="flex items-center gap-4 px-4 py-2.5">
        <div className="flex items-center gap-1">
          <BotonTransporte etiqueta="Volver al principio" atajo="Inicio" onClick={r.reiniciar} deshabilitado={r.paso === 0 && !r.reproduciendo}>
            <RotateCcw size={17} />
          </BotonTransporte>
          <BotonTransporte etiqueta="Paso anterior" atajo="←" onClick={r.anterior} deshabilitado={r.paso === 0}>
            <StepBack size={17} />
          </BotonTransporte>
          <BotonTransporte etiqueta={r.reproduciendo ? 'Pausa' : 'Reproducir'} atajo="Espacio" onClick={r.alternar} deshabilitado={ultimo === 0} principal>
            {r.reproduciendo ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="translate-x-px" />}
          </BotonTransporte>
          <BotonTransporte etiqueta="Paso siguiente" atajo="→" onClick={r.siguiente} deshabilitado={r.enElFinal}>
            <StepForward size={17} />
          </BotonTransporte>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative h-6 flex-1">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-superficie-3" />
            <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-hueso" style={{ width: `${avance}%` }} />
            <div
              className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hueso shadow-[0_0_0_3px_var(--color-superficie)]"
              style={{ left: `${avance}%` }}
            />
            <input
              type="range"
              min={0}
              max={ultimo}
              step={1}
              value={r.paso}
              onChange={(e) => {
                r.pausar()
                r.irA(Number(e.target.value))
              }}
              aria-label={`Avance de la animación (${unidad})`}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <span className="mono cifras min-w-28 shrink-0 whitespace-nowrap text-right text-xs text-tinta-2" data-contador>
            {unidad} {r.total === 0 ? 0 : r.paso + 1} / {r.total}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1" title="Velocidad (+ / −)">
          <button
            type="button"
            onClick={r.masLento}
            aria-label="Más lento"
            className="grid h-7 w-7 place-items-center rounded-full text-tinta-2 hover:bg-superficie-3 hover:text-tinta"
          >
            <Minus size={14} />
          </button>
          <span className="mono cifras w-12 text-center text-xs text-tinta">{r.velocidad}×</span>
          <button
            type="button"
            onClick={r.masRapido}
            aria-label="Más rápido"
            className="grid h-7 w-7 place-items-center rounded-full text-tinta-2 hover:bg-superficie-3 hover:text-tinta"
          >
            <Plus size={14} />
          </button>
        </div>

        {extra && <div className="flex shrink-0 items-center gap-2 border-l border-linea pl-4">{extra}</div>}
      </div>
    </div>
  )
}
