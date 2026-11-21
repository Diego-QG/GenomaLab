// Piezas pequeñas de interfaz que se repiten en todas las pantallas.

import { useEffect, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react'
import { CircleAlert, LoaderCircle, RotateCcw } from 'lucide-react'
import { useApp } from '@/estado/app'
import { colorDeGrupo, infoDeGrupo } from '@/lib/colores'
import { clases } from '@/lib/formato'
import { esErrorDeRespuestaIncompleta } from '@compartido/validacion'

// ── Botón ────────────────────────────────────────────────────────────────────

type VarianteBoton = 'primario' | 'borde' | 'fantasma'

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  tamano?: 's' | 'm'
  icono?: ReactNode
}

const ESTILO_BOTON: Record<VarianteBoton, string> = {
  primario: 'bg-hueso text-fondo font-semibold hover:bg-white disabled:bg-superficie-3 disabled:text-tinta-3',
  borde: 'border border-linea-fuerte text-tinta hover:border-tinta-3 hover:bg-superficie-2 disabled:text-tinta-3 disabled:hover:bg-transparent',
  fantasma: 'text-tinta-2 hover:bg-superficie-2 hover:text-tinta disabled:text-tinta-3 disabled:hover:bg-transparent',
}

export function Boton({ variante = 'borde', tamano = 'm', icono, className, children, type = 'button', ...resto }: PropsBoton) {
  return (
    <button
      type={type}
      className={clases(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md transition-colors duration-150',
        tamano === 'm' ? 'h-9 px-3.5 text-sm' : 'h-7 px-2.5 text-xs',
        ESTILO_BOTON[variante],
        className,
      )}
      {...resto}
    >
      {icono}
      {children}
    </button>
  )
}

// ── Selector de opciones en línea (k = 3 / 6, pestañas…) ─────────────────────

interface PropsSegmentos<T extends string | number> {
  opciones: readonly { valor: T; etiqueta: ReactNode; titulo?: string }[]
  valor: T
  alCambiar: (valor: T) => void
  etiqueta: string
  tamano?: 's' | 'm'
}

export function Segmentos<T extends string | number>({ opciones, valor, alCambiar, etiqueta, tamano = 'm' }: PropsSegmentos<T>) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex shrink-0 rounded-md border border-linea bg-superficie p-0.5">
      {opciones.map((o) => {
        const activa = o.valor === valor
        return (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={activa}
            title={o.titulo}
            onClick={() => alCambiar(o.valor)}
            className={clases(
              'rounded-[0.3rem] transition-colors duration-150',
              tamano === 'm' ? 'h-8 px-3 text-sm' : 'h-6 px-2 text-xs',
              activa ? 'bg-superficie-3 text-tinta' : 'text-tinta-3 hover:text-tinta-2',
            )}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

// ── Grupo de un virus ────────────────────────────────────────────────────────

/** Etiqueta de grupo: un punto de color y el nombre (el color nunca va solo). */
export function ChipGrupo({ grupo, className }: { grupo: string; className?: string }) {
  return (
    <span
      title={infoDeGrupo(grupo).descripcion}
      className={clases('inline-flex shrink-0 items-center gap-1.5 rounded-full border border-linea px-2 py-px text-xs text-tinta-2', className)}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: colorDeGrupo(grupo) }} />
      <span className="estrecho">{grupo}</span>
    </span>
  )
}

// ── Estados de una consulta al motor ─────────────────────────────────────────

export function Cargando({ texto = 'Esperando al motor…' }: { texto?: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center gap-3 text-tinta-3" role="status">
      <LoaderCircle size={18} className="animate-spin" />
      <span>{texto}</span>
    </div>
  )
}

export function ErrorDelMotorVisible({ error, alReintentar }: { error: string; alReintentar?: () => void }) {
  const incompleta = esErrorDeRespuestaIncompleta(error)
  const exe = useApp((s) => s.motor?.exe ?? null)
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-3 px-8 text-center" role="alert" data-error-motor={incompleta ? 'incompleta' : 'fallo'}>
      <CircleAlert size={22} className={incompleta ? 'text-aviso' : 'text-mal'} />
      <p className="max-w-xl text-tinta">{incompleta ? 'La respuesta del motor llegó incompleta.' : 'El motor no pudo responder.'}</p>
      <p className="mono max-w-2xl select-text text-xs leading-relaxed text-tinta-2">{error}</p>
      {incompleta ? (
        <p className="max-w-xl text-xs text-tinta-3">El resto de la app sigue funcionando. Cuando el motor envíe ese campo, vuelve a intentar.</p>
      ) : (
        <p className="max-w-xl text-xs leading-relaxed text-tinta-3">
          Si el problema sigue, compila el proyecto en CLion o Code::Blocks y vuelve a abrir la app.
          {exe && (
            <>
              <br />
              Motor: <span className="mono select-text break-all">{exe}</span>
            </>
          )}
        </p>
      )}
      {alReintentar && (
        <Boton onClick={alReintentar} icono={<RotateCcw size={14} />}>
          Volver a intentar
        </Boton>
      )}
    </div>
  )
}

// ── Dato con su etiqueta ─────────────────────────────────────────────────────

export function Dato({ etiqueta, children, titulo }: { etiqueta: string; children: ReactNode; titulo?: string }) {
  return (
    <div title={titulo}>
      <div className="text-xs text-tinta-3">{etiqueta}</div>
      <div className="mt-0.5 text-xl font-semibold leading-tight text-tinta">{children}</div>
    </div>
  )
}

// ── Cabecera de pantalla ─────────────────────────────────────────────────────

export function Cabecera({ titulo, descripcion, children }: { titulo: string; descripcion?: ReactNode; children?: ReactNode }) {
  // En modo presentación el espacio es para la animación: solo queda el título
  const presentacion = useApp((s) => s.presentacion)
  return (
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-2 px-6 pb-3 pt-4">
      <div className="min-w-0">
        <h1 className="text-[1.4rem] leading-tight">{titulo}</h1>
        {descripcion && !presentacion && <p className="mt-0.5 max-w-[78ch] text-[0.82rem] text-tinta-2">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  )
}

// ── Utilidades de comportamiento ─────────────────────────────────────────────

/** Llama a `alSalir` al hacer clic fuera del elemento o al pulsar Escape. */
export function useCerrarAlSalir(ref: RefObject<HTMLElement | null>, activo: boolean, alSalir: () => void): void {
  useEffect(() => {
    if (!activo) return
    const alPulsar = (e: MouseEvent): void => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) alSalir()
    }
    const alTeclear = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        alSalir()
      }
    }
    document.addEventListener('mousedown', alPulsar)
    document.addEventListener('keydown', alTeclear, true)
    return () => {
      document.removeEventListener('mousedown', alPulsar)
      document.removeEventListener('keydown', alTeclear, true)
    }
  }, [ref, activo, alSalir])
}
