import { Fragment } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, CircleDashed } from 'lucide-react'
import type { TablaResumen } from '@compartido/contrato'
import { Boton, Dato } from '@/componentes/ui'
import { useApp } from '@/estado/app'
import { decimal, entero } from '@/lib/formato'

/** Lado del cuadrado que representa una tabla de `tamano` casillas (área ∝ capacidad). */
function lado(tamano: number, maximo: number): number {
  return 8 + 34 * Math.sqrt(tamano / maximo)
}

/**
 * Resumen de la TablaVirus (tabla hash por ID) y línea de tiempo de sus
 * redimensionamientos: 10 → 23 → … → 797. Todo viene del comando `resumen`.
 */
export function ResumenTabla({ tabla }: { tabla: TablaResumen | null }) {
  const ir = useApp((s) => s.ir)
  if (tabla === null) return <TablaSinDatos alVerBusqueda={() => ir('buscar')} />
  // Tamaños por los que pasó la tabla: el inicial y cada "a" de un redimensionamiento
  const etapas = tabla.redimensiones.length > 0 ? [tabla.redimensiones[0].de, ...tabla.redimensiones.map((r) => r.a)] : [tabla.tamano]
  const maximo = Math.max(...etapas)

  return (
    <section className="mx-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-linea bg-superficie px-5 py-4" aria-label="Tabla hash de virus">
      <Presentacion alVerBusqueda={() => ir('buscar')} />

      <div className="flex shrink-0 gap-7">
        <Dato etiqueta="Casillas">{entero(tabla.tamano)}</Dato>
        <Dato etiqueta="Virus guardados">{entero(tabla.cantidad)}</Dato>
        <Dato etiqueta="Colisiones" titulo="Veces que una casilla ya estaba ocupada al insertar (incluye las reinserciones al crecer)">
          {entero(tabla.colisiones)}
        </Dato>
        <Dato etiqueta="Factor de carga" titulo="Virus guardados ÷ casillas">
          {decimal(tabla.factorCarga, 2)}
        </Dato>
      </div>

      <div className="ml-auto flex shrink-0 items-end gap-1" aria-label="Redimensionamientos de la tabla">
        {etapas.map((tamano, i) => {
          const esUltima = i === etapas.length - 1
          const px = lado(tamano, maximo)
          const redimension = tabla.redimensiones[i] // la que llevó de esta etapa a la siguiente
          return (
            <Fragment key={tamano}>
              <motion.div
                className="flex flex-col items-center gap-1.5"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.11, duration: 0.3 }}
              >
                <div
                  className="relative overflow-hidden rounded-[3px] border"
                  style={{ width: px, height: px, borderColor: esUltima ? 'var(--color-hueso)' : 'var(--color-linea-fuerte)' }}
                  title={esUltima ? `Tabla actual: ${entero(tamano)} casillas, ${entero(tabla.cantidad)} ocupadas` : `Tabla de ${entero(tamano)} casillas`}
                >
                  {esUltima && <div className="absolute inset-x-0 bottom-0 bg-fluor-4" style={{ height: `${tabla.factorCarga * 100}%` }} />}
                </div>
                <span className={`mono cifras text-xs ${esUltima ? 'font-bold text-tinta' : 'text-tinta-2'}`}>{tamano}</span>
              </motion.div>
              {redimension && (
                <motion.div
                  className="flex w-11 flex-col items-center pb-[1.15rem] text-tinta-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.32 + i * 0.11, duration: 0.3 }}
                  title={`Al insertar el virus n.º ${redimension.enInsercion}, la tabla de ${redimension.de} pasó a ${redimension.a}`}
                >
                  <span className="estrecho whitespace-nowrap text-2xs">virus {redimension.enInsercion}</span>
                  <ArrowRight size={13} />
                </motion.div>
              )}
            </Fragment>
          )
        })}
      </div>

    </section>
  )
}

function Presentacion({ alVerBusqueda }: { alVerBusqueda: () => void }) {
  return (
    <div className="w-60 shrink-0">
      <h2 className="text-sm">TablaVirus</h2>
      <p className="mt-1 text-xs leading-snug text-tinta-3">Tabla hash por ID, con sondeo lineal. Crece al siguiente primo cuando pasaría de la mitad.</p>
      <Boton tamano="s" className="mt-2.5" onClick={alVerBusqueda}>
        Ver una búsqueda paso a paso
      </Boton>
    </div>
  )
}

/** Lo que se ve cuando el motor respondió `resumen` sin el campo `tabla` (o incompleto). */
function TablaSinDatos({ alVerBusqueda }: { alVerBusqueda: () => void }) {
  return (
    <section
      className="mx-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-dashed border-linea-fuerte px-5 py-4"
      aria-label="Tabla hash de virus"
      data-tabla-sin-datos
    >
      <Presentacion alVerBusqueda={alVerBusqueda} />
      <div className="flex min-w-0 flex-1 items-start gap-3 text-sm">
        <CircleDashed size={18} className="mt-0.5 shrink-0 text-aviso" />
        <p className="max-w-[60ch] leading-snug text-tinta-2">
          El motor respondió <code className="mono text-xs text-tinta">resumen</code> sin el campo{' '}
          <code className="mono text-xs text-tinta">tabla</code> (o llegó incompleto), así que aquí no hay casillas, colisiones ni
          redimensionamientos que mostrar. Las tarjetas de abajo sí vienen del motor.
        </p>
      </div>
    </section>
  )
}
