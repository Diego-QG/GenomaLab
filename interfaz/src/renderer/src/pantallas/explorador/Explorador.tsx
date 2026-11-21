import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Cabecera, Segmentos } from '@/componentes/ui'
import { useApp, useNombreArchivo } from '@/estado/app'
import { colorDeGrupo, infoDeGrupo } from '@/lib/colores'
import { clases, entero } from '@/lib/formato'
import { Rejilla } from './Rejilla'
import { ResumenTabla } from './ResumenTabla'

type Orden = 'archivo' | 'longitud' | 'gc'

/** Lo que dura la entrada con vuelo de tarjetas al llegar desde Inicio. */
const DURACION_ENTRADA_MS = 1800

/**
 * Pantalla 2 — Explorador: todas las secuencias como tarjetas, con buscador,
 * filtro por grupo y el resumen de la tabla hash de virus.
 */
export function Explorador() {
  const resumen = useApp((s) => s.resumen)
  const nombreArchivo = useNombreArchivo()
  const abrirVirus = useApp((s) => s.abrirVirus)
  const terminarEntrada = useApp((s) => s.terminarEntrada)

  const [texto, setTexto] = useState('')
  const [grupos, setGrupos] = useState<ReadonlySet<string>>(new Set())
  const [orden, setOrden] = useState<Orden>('archivo')

  // La entrada animada solo ocurre justo al llegar desde Inicio
  const [entrada, setEntrada] = useState(() => useApp.getState().entradaPendiente)
  useEffect(() => {
    if (!entrada) return
    const t = window.setTimeout(() => {
      setEntrada(false)
      terminarEntrada()
    }, DURACION_ENTRADA_MS)
    return () => window.clearTimeout(t)
  }, [entrada, terminarEntrada])

  const conteoPorGrupo = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const v of resumen?.virus ?? []) conteo.set(v.grupo, (conteo.get(v.grupo) ?? 0) + 1)
    return [...conteo.entries()].sort((a, b) => b[1] - a[1])
  }, [resumen])

  const filtrados = useMemo(() => {
    const buscado = texto.trim().toLowerCase()
    let lista = (resumen?.virus ?? []).filter((v) => (grupos.size === 0 || grupos.has(v.grupo)) && (!buscado || v.id.toLowerCase().includes(buscado)))
    if (orden === 'longitud') lista = [...lista].sort((a, b) => b.longitud - a.longitud)
    else if (orden === 'gc') lista = [...lista].sort((a, b) => b.gc - a.gc)
    return lista
  }, [resumen, texto, grupos, orden])

  if (!resumen) return null

  const alternarGrupo = (grupo: string): void => {
    setGrupos((previos) => {
      const nuevos = new Set(previos)
      if (nuevos.has(grupo)) nuevos.delete(grupo)
      else nuevos.add(grupo)
      return nuevos
    })
  }

  return (
    <div className="flex h-full flex-col">
      <Cabecera
        titulo="Explorador"
        descripcion={`${entero(resumen.total)} secuencias de ${nombreArchivo ?? 'el archivo cargado'}. Cada franja de color es una base; haz clic en una tarjeta para abrir el virus.`}
      >
        <label className="flex h-9 w-72 items-center gap-2 rounded-md border border-linea-fuerte bg-superficie px-3 focus-within:border-hueso">
          <Search size={15} className="shrink-0 text-tinta-3" />
          <input
            id="buscador-explorador"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por ID"
            spellCheck={false}
            className="mono h-full min-w-0 flex-1 bg-transparent text-xs text-tinta outline-none placeholder:font-sans placeholder:text-sm placeholder:text-tinta-3"
          />
          {texto && (
            <button type="button" onClick={() => setTexto('')} aria-label="Borrar la búsqueda" className="text-tinta-3 hover:text-tinta">
              <X size={14} />
            </button>
          )}
        </label>
        <Segmentos
          etiqueta="Orden de las tarjetas"
          valor={orden}
          alCambiar={setOrden}
          opciones={[
            { valor: 'archivo', etiqueta: 'Orden del archivo' },
            { valor: 'longitud', etiqueta: 'Más largas' },
            { valor: 'gc', etiqueta: 'Más GC' },
          ]}
        />
      </Cabecera>

      <ResumenTabla tabla={resumen.tabla} />

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-6 py-4" role="group" aria-label="Filtrar por grupo">
        <button
          type="button"
          onClick={() => setGrupos(new Set())}
          aria-pressed={grupos.size === 0}
          className={clases(
            'h-7 rounded-full border px-3 text-xs transition-colors',
            grupos.size === 0 ? 'border-hueso bg-hueso font-semibold text-fondo' : 'border-linea-fuerte text-tinta-2 hover:border-tinta-3 hover:text-tinta',
          )}
        >
          Todos <span className="cifras ml-1 opacity-70">{entero(resumen.total)}</span>
        </button>
        {conteoPorGrupo.map(([grupo, cantidad]) => {
          const elegido = grupos.has(grupo)
          return (
            <button
              key={grupo}
              type="button"
              data-grupo={grupo}
              onClick={() => alternarGrupo(grupo)}
              aria-pressed={elegido}
              title={infoDeGrupo(grupo).descripcion}
              className={clases(
                'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors',
                elegido ? 'border-tinta bg-superficie-3 text-tinta' : 'border-linea-fuerte text-tinta-2 hover:border-tinta-3 hover:text-tinta',
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colorDeGrupo(grupo) }} />
              <span className="estrecho">{grupo}</span>
              <span className="cifras text-tinta-3">{entero(cantidad)}</span>
            </button>
          )
        })}
        <span className="cifras ml-auto text-xs text-tinta-3" aria-live="polite">
          {filtrados.length === resumen.total ? `${entero(resumen.total)} virus` : `${entero(filtrados.length)} de ${entero(resumen.total)} virus`}
        </span>
      </div>

      <Rejilla virus={filtrados} alAbrir={(id) => abrirVirus(id)} entrada={entrada} />
    </div>
  )
}
