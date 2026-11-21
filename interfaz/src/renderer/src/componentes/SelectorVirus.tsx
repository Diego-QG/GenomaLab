import { useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useApp } from '@/estado/app'
import { colorDeGrupo } from '@/lib/colores'
import { clases, entero } from '@/lib/formato'
import { useCerrarAlSalir } from './ui'

interface Props {
  valor: string | null
  alElegir: (id: string) => void
  /** Para qué es este selector ("Virus en estudio", "Comparar con"…). */
  etiqueta: string
  /** Un virus que no se puede elegir (por ejemplo, el otro de la comparación). */
  excluir?: string | null
  alineacion?: 'izquierda' | 'derecha'
}

/** Desplegable con buscador para elegir uno de los virus cargados. */
export function SelectorVirus({ valor, alElegir, etiqueta, excluir = null, alineacion = 'izquierda' }: Props) {
  const virus = useApp((s) => s.resumen?.virus)
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const contenedor = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLUListElement>(null)

  useCerrarAlSalir(contenedor, abierto, () => setAbierto(false))

  const filtrados = useMemo(() => {
    const todos = (virus ?? []).filter((v) => v.id !== excluir)
    const buscado = texto.trim().toLowerCase()
    if (!buscado) return todos
    return todos.filter((v) => v.id.toLowerCase().includes(buscado) || v.grupo.toLowerCase() === buscado)
  }, [virus, texto, excluir])

  const actual = virus?.find((v) => v.id === valor)

  const elegir = (id: string): void => {
    alElegir(id)
    setAbierto(false)
    setTexto('')
  }

  const mover = (delta: number): void => {
    const siguiente = Math.min(filtrados.length - 1, Math.max(0, resaltado + delta))
    setResaltado(siguiente)
    lista.current?.children[siguiente]?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => {
          setAbierto((a) => !a)
          setResaltado(0)
        }}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        title={etiqueta}
        className="flex h-9 max-w-[22rem] items-center gap-2 rounded-md border border-linea-fuerte bg-superficie px-2.5 text-left hover:border-tinta-3"
      >
        <span className="shrink-0 text-xs text-tinta-3">{etiqueta}</span>
        {actual ? (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorDeGrupo(actual.grupo) }} />
            <span className="mono truncate text-xs text-tinta">{actual.id}</span>
          </>
        ) : (
          <span className="text-xs text-tinta-3">ninguno</span>
        )}
        <ChevronDown size={14} className="shrink-0 text-tinta-3" />
      </button>

      {abierto && (
        <div
          className={clases(
            'absolute top-full z-40 mt-1.5 w-[26rem] overflow-hidden rounded-lg border border-linea-fuerte bg-superficie-2 shadow-2xl shadow-black/60',
            alineacion === 'derecha' ? 'right-0' : 'left-0',
          )}
        >
          <label className="flex items-center gap-2 border-b border-linea px-3">
            <Search size={14} className="shrink-0 text-tinta-3" />
            <input
              autoFocus
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                setResaltado(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  mover(1)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  mover(-1)
                } else if (e.key === 'Enter' && filtrados[resaltado]) {
                  elegir(filtrados[resaltado].id)
                }
              }}
              placeholder="Escribe parte del ID o un grupo (A, B, SMM…)"
              spellCheck={false}
              className="h-10 w-full bg-transparent text-sm text-tinta outline-none placeholder:text-tinta-3"
            />
          </label>
          <ul ref={lista} role="listbox" aria-label={etiqueta} className="max-h-80 overflow-y-auto py-1">
            {filtrados.map((v, i) => (
              <li key={v.id} role="option" aria-selected={v.id === valor}>
                <button
                  type="button"
                  onClick={() => elegir(v.id)}
                  onMouseEnter={() => setResaltado(i)}
                  className={clases(
                    'flex w-full items-center gap-2.5 px-3 py-1.5 text-left',
                    i === resaltado && 'bg-superficie-3',
                    v.id === valor && 'text-hueso',
                  )}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorDeGrupo(v.grupo) }} />
                  <span className="mono min-w-0 flex-1 truncate text-xs">{v.id}</span>
                  <span className="estrecho shrink-0 text-xs text-tinta-3">{v.grupo}</span>
                  <span className="mono cifras w-12 shrink-0 text-right text-2xs text-tinta-3">{entero(v.longitud)}</span>
                </button>
              </li>
            ))}
            {filtrados.length === 0 && <li className="px-3 py-4 text-center text-sm text-tinta-3">Ningún virus coincide con “{texto}”.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
