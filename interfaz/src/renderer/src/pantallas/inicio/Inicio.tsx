import { useEffect, useRef, useState, type DragEvent } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, FileText, FolderOpen, Upload } from 'lucide-react'
import { Boton } from '@/componentes/ui'
import { useApp, useNombreArchivo, type OrigenFasta } from '@/estado/app'
import { clases, entero } from '@/lib/formato'
import { Helice } from './Helice'

/** Lo que tarda la hélice en deshacerse antes de pasar al Explorador. */
const ESPERA_DESARME_MS = 1050

/**
 * Pantalla 1 — Inicio: la hélice girando y la zona para cargar un FASTA.
 * Al cargar, la hélice se desarma y la app pasa al Explorador.
 */
export function Inicio() {
  const motor = useApp((s) => s.motor)
  const resumen = useApp((s) => s.resumen)
  const nombreArchivo = useNombreArchivo()
  const cargando = useApp((s) => s.cargando)
  const error = useApp((s) => s.errorDeCarga)
  const cargarFasta = useApp((s) => s.cargarFasta)
  const ir = useApp((s) => s.ir)

  const [encima, setEncima] = useState(false)
  const [desarmar, setDesarmar] = useState(false)
  const profundidad = useRef(0)
  const temporizador = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  const cargar = async (origen: OrigenFasta): Promise<void> => {
    if (cargando || desarmar) return
    const cargado = await cargarFasta(origen)
    if (!cargado) return
    setDesarmar(true)
    temporizador.current = window.setTimeout(() => ir('explorador', { desdeInicio: true }), ESPERA_DESARME_MS)
  }

  const alSoltar = (e: DragEvent): void => {
    e.preventDefault()
    profundidad.current = 0
    setEncima(false)
    const archivo = e.dataTransfer.files[0]
    if (archivo) void cargar({ tipo: 'archivo', archivo })
  }

  const ocupado = cargando || desarmar
  const delProyecto = motor?.fastaDelProyecto ?? null

  return (
    <div
      className="relative h-full overflow-hidden"
      onDragEnter={(e) => {
        e.preventDefault()
        profundidad.current++
        setEncima(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        profundidad.current = Math.max(0, profundidad.current - 1)
        if (profundidad.current === 0) setEncima(false)
      }}
      onDrop={alSoltar}
    >
      {/* Luz de fondo, como una lámpara ultravioleta detrás de la hélice */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(55% 60% at 68% 48%, rgba(122, 99, 232, 0.2), transparent 70%)' }}
      />

      <div className="absolute inset-y-0 right-0 w-[58%]">
        <Helice desarmar={desarmar} />
      </div>

      <motion.div
        className="relative flex h-full max-w-[40rem] flex-col justify-center px-12"
        animate={{ opacity: desarmar ? 0 : 1, x: desarmar ? -24 : 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-[2.6rem] leading-[1.08]">Tablas hash, un heap y un grafo, vistos por dentro</h1>
        <p className="mt-5 max-w-[54ch] text-base leading-relaxed text-tinta-2">
          Carga un archivo FASTA. El motor en C++ analiza las secuencias y aquí se ve cada paso: cómo un ID cae en su casilla, cómo chocan los
          k-mers y cómo sube un nodo por el heap.
        </p>

        <div
          className={clases(
            'mt-9 rounded-xl border-2 border-dashed px-6 py-7 transition-colors duration-150',
            encima ? 'border-hueso bg-hueso/8' : 'border-linea-fuerte bg-superficie/60',
          )}
        >
          <div className="flex items-center gap-5">
            <div className={clases('grid h-12 w-12 shrink-0 place-items-center rounded-full border', encima ? 'border-hueso text-hueso' : 'border-linea-fuerte text-tinta-2')}>
              <Upload size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-tinta">{encima ? 'Suelta el archivo para cargarlo' : 'Arrastra tu FASTA aquí'}</div>
              <div className="mt-0.5 text-sm text-tinta-3">Archivos .fasta, .fa o .txt con secuencias de ADN</div>
            </div>
            <Boton variante="primario" icono={<FolderOpen size={15} />} disabled={ocupado} onClick={() => void cargar({ tipo: 'dialogo' })}>
              Elegir archivo…
            </Boton>
          </div>
        </div>

        {delProyecto && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-linea px-4 py-3">
            <FileText size={16} className="shrink-0 text-tinta-3" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-tinta-2">El archivo del proyecto</div>
              <div className="mono truncate text-xs text-tinta">{delProyecto.nombre}</div>
            </div>
            <Boton id="usar-fasta-proyecto" disabled={ocupado} onClick={() => void cargar({ tipo: 'proyecto' })}>
              {ocupado ? 'Cargando…' : 'Usar este archivo'}
            </Boton>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-mal/50 bg-mal/10 px-4 py-3 text-sm text-tinta">
            No se pudo cargar el archivo. <span className="mono select-text text-xs text-tinta-2">{error}</span>
          </p>
        )}

        {resumen && !ocupado && (
          <button
            type="button"
            onClick={() => ir('explorador')}
            className="mt-6 flex items-center gap-2 self-start text-sm text-tinta-2 underline-offset-4 hover:text-tinta hover:underline"
          >
            Ya hay {entero(resumen.total)} virus cargados de {nombreArchivo ?? 'el archivo cargado'}: ir al explorador
            <ArrowRight size={14} />
          </button>
        )}
      </motion.div>
    </div>
  )
}
