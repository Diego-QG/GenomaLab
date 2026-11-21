import { CircleAlert, RotateCcw, X } from 'lucide-react'
import { AVISO_SIN_MOTOR, type EstadoMotor } from '@compartido/puente'
import { Boton } from '@/componentes/ui'
import { useApp } from '@/estado/app'

/** AVISO_SIN_MOTOR sin su primera frase, que ya es el título. */
const COMPILAR = AVISO_SIN_MOTOR.replace(/^No se encontró el motor\.\s*/, '')

/**
 * Lo que se ve en lugar de las pantallas cuando el motor en C++ no está en
 * ninguna de las rutas conocidas, o está pero no se puede ejecutar.
 * La interfaz no responde nada por su cuenta: sin motor no hay datos.
 */
export function SinMotor({ motor }: { motor: EstadoMotor }) {
  const buscarMotor = useApp((s) => s.buscarMotor)
  const buscando = useApp((s) => s.buscandoMotor)
  const noEncontrado = motor.exe === null

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-8 py-6" role="alert" id="aviso-sin-motor">
      <div className="w-full max-w-2xl rounded-xl border border-mal/50 bg-superficie px-7 py-6">
        <div className="flex items-start gap-4">
          <CircleAlert size={24} className="mt-0.5 shrink-0 text-mal" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl">{noEncontrado ? 'No se encontró el motor' : 'El motor no se pudo ejecutar'}</h1>
            <p className="mt-2 text-base leading-relaxed text-tinta">{COMPILAR}</p>

            {noEncontrado ? (
              <>
                <p className="mt-5 text-sm text-tinta-2">Se buscó, en este orden:</p>
                <ul className="mt-2 space-y-1">
                  {motor.buscadas.map((ruta) => (
                    <li key={ruta} className="flex items-start gap-2">
                      <X size={13} className="mt-[3px] shrink-0 text-mal" aria-label="no está" />
                      <span className="mono select-text break-all text-xs text-tinta-2">{ruta}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mt-5 text-sm text-tinta-2">Motor encontrado en:</p>
                <p className="mono mt-1 select-text break-all text-xs text-tinta">{motor.exe}</p>
                <p className="mt-4 text-sm text-tinta-2">Lo que pasó al ejecutarlo:</p>
                <p className="mono mt-1 select-text text-xs leading-relaxed text-tinta-2">{motor.fallo}</p>
              </>
            )}

            <div className="mt-6 flex items-center gap-3">
              <Boton variante="primario" icono={<RotateCcw size={14} />} disabled={buscando} onClick={() => void buscarMotor()}>
                {buscando ? 'Buscando…' : 'Buscar de nuevo'}
              </Boton>
              <span className="text-xs text-tinta-3">Si ya lo compilaste, no hace falta cerrar la app.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
