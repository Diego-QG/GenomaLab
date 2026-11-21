import { useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { TriangleAlert, X } from 'lucide-react'
import { describirProblema, type ProblemaDeCampo } from '@compartido/validacion'
import { useCerrarAlSalir } from '@/componentes/ui'
import { clases } from '@/lib/formato'
import { useAvisos, type AvisoDeContrato } from '@/motor/avisos'

/** Los "imprescindibles" primero: son los que dejaron una vista sin dibujar. */
function ordenar(problemas: readonly ProblemaDeCampo[]): ProblemaDeCampo[] {
  const peso = { imprescindible: 0, descartado: 1, suplido: 2 } as const
  return [...problemas].sort((a, b) => peso[a.consecuencia] - peso[b.consecuencia])
}

function Aviso({ aviso }: { aviso: AvisoDeContrato }) {
  const linea = [aviso.comando, ...aviso.args].join(' ')
  return (
    <li className="border-t border-linea px-4 py-3 first:border-t-0" data-aviso-comando={aviso.comando}>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-tinta-3">Comando</span>
        <code className="mono min-w-0 truncate text-xs font-semibold text-tinta" title={linea}>
          {linea}
        </code>
        {aviso.veces > 1 && <span className="ml-auto shrink-0 text-2xs text-tinta-3">{aviso.veces} respuestas</span>}
      </div>
      <p className={clases('mt-1 text-xs', aviso.bloqueante ? 'text-mal' : 'text-tinta-2')}>
        {aviso.bloqueante
          ? 'Faltó algo imprescindible: esa vista muestra un error en lugar de dibujarse.'
          : 'Se muestra lo que sí llegó; lo que falta queda en blanco o con «—».'}
      </p>
      <ul className="mt-1.5 space-y-1">
        {ordenar(aviso.problemas).map((p) => (
          <li
            key={`${p.ruta}|${p.consecuencia}|${p.motivo}`}
            className={clases('mono select-text text-2xs leading-snug', p.consecuencia === 'imprescindible' ? 'text-mal' : 'text-tinta-2')}
          >
            · {describirProblema(p)}
          </li>
        ))}
      </ul>
    </li>
  )
}

/**
 * Indicador en la barra superior: aparece solo si alguna respuesta del motor llegó
 * sin campos del contrato. Se despliega solo cuando hay algo nuevo y se puede plegar;
 * mientras haya avisos, el indicador queda a la vista.
 */
export function AvisosDelMotor() {
  const avisos = useAvisos((s) => s.avisos)
  const abierto = useAvisos((s) => s.abierto)
  const abrir = useAvisos((s) => s.abrir)
  const vaciar = useAvisos((s) => s.vaciar)
  const ref = useRef<HTMLDivElement>(null)
  const cerrar = useCallback(() => abrir(false), [abrir])
  useCerrarAlSalir(ref, abierto, cerrar)

  if (avisos.length === 0) return null
  const bloqueante = avisos.some((a) => a.bloqueante)

  return (
    <div ref={ref} className="no-arrastrable relative shrink-0">
      <button
        type="button"
        id="indicador-avisos"
        onClick={() => abrir(!abierto)}
        aria-expanded={abierto}
        title="Respuestas del motor sin algunos campos del contrato (clic para ver qué comando y qué campo)"
        className={clases(
          'flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold transition-colors',
          bloqueante ? 'border-mal/60 text-mal hover:bg-mal/10' : 'border-aviso/60 text-aviso hover:bg-aviso/10',
        )}
      >
        <TriangleAlert size={13} />
        Incompleta
        <span className="cifras rounded-full bg-current/15 px-1.5 text-2xs">{avisos.length}</span>
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            role="dialog"
            aria-label="Respuestas incompletas del motor"
            id="panel-avisos"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-9 z-50 flex max-h-[min(30rem,70vh)] w-[27rem] flex-col overflow-hidden rounded-xl border border-linea-fuerte bg-superficie shadow-2xl shadow-black/50"
          >
            <div className="flex items-start gap-3 border-b border-linea px-4 py-3">
              <TriangleAlert size={16} className={clases('mt-0.5 shrink-0', bloqueante ? 'text-mal' : 'text-aviso')} />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm">El motor respondió sin algunos campos del contrato</h2>
                <p className="mt-0.5 text-xs leading-snug text-tinta-3">
                  La interfaz sigue funcionando con lo que llegó. Los campos esperados están en BRIEF-INTERFAZ.md, sección 5.
                </p>
              </div>
              <button type="button" onClick={cerrar} aria-label="Plegar los avisos" className="grid h-6 w-6 shrink-0 place-items-center rounded text-tinta-3 hover:bg-superficie-2 hover:text-tinta">
                <X size={14} />
              </button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {avisos.map((a) => (
                <Aviso key={a.comando} aviso={a} />
              ))}
            </ul>
            <div className="flex items-center justify-end gap-2 border-t border-linea px-4 py-2">
              <button
                type="button"
                onClick={vaciar}
                title="Quitar estos avisos (vuelven si llega otra respuesta incompleta)"
                className="h-7 rounded-md border border-linea-fuerte px-2.5 text-xs text-tinta hover:bg-superficie-2"
              >
                Descartar avisos
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
