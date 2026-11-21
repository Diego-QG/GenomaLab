import { useMemo, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { InsercionKmer, RespuestaTrazaKmers } from '@compartido/contrato'
import { Kmer } from '@/componentes/Base'
import { Controles } from '@/componentes/reproductor/Controles'
import { useReproductor } from '@/componentes/reproductor/useReproductor'
import { Boton, Cargando, ErrorDelMotorVisible, Segmentos } from '@/componentes/ui'
import { agruparDigitos, entero } from '@/lib/formato'
import { useMotor } from '@/motor/cliente'
import { colisionesTotales, construirCuadros, esDescartada, estadoEn, type Cuadro, type EstadoTabla } from './modelo'
import { TablaChica, TablaGrande } from './Tablas'
import { VentanaDeslizante } from './VentanaDeslizante'

/** Colores que identifican a cada método en toda la pantalla. */
export const COLOR_LINEAL = '#f0894a'
export const COLOR_DOBLE = '#3fb3e8'

function columnasPara(tamano: number): number {
  if (tamano <= 16) return tamano
  if (tamano <= 64) return 16
  return 128
}

function Num({ children }: { children: ReactNode }) {
  return <span className="mono cifras font-semibold text-hueso">{children}</span>
}

/** Qué le pasó a la inserción actual en una de las dos tablas. */
function relato(insercion: InsercionKmer, estado: EstadoTabla): ReactNode {
  if (estado.resultado === 'descartado') return 'no se inserta'
  const ultimo = estado.camino[estado.camino.length - 1]
  if (!ultimo) return 'esperando'
  if (estado.resultado === 'nuevo') {
    return (
      <>
        casilla <Num>{ultimo.pos}</Num> libre: se guarda por primera vez
      </>
    )
  }
  if (estado.resultado === 'sumado') {
    return (
      <>
        ya estaba en la casilla <Num>{ultimo.pos}</Num>: su conteo sube a <Num>{insercion.conteoFinal}</Num>
      </>
    )
  }
  return (
    <>
      casilla <Num>{ultimo.pos}</Num> ocupada por <Num>{ultimo.kmerEnCasilla}</Num>: colisión, salta <Num>+{insercion.paso}</Num>
    </>
  )
}

interface PropsLado {
  nombre: string
  regla: string
  color: string
  traza: RespuestaTrazaKmers
  insercion: InsercionKmer
  estado: EstadoTabla
  /** Colisiones al final de la traza de la tabla a la que más le costó (escala común de las barras). */
  escala: number
}

function Lado({ nombre, regla, color, traza, insercion, estado, escala }: PropsLado) {
  const columnas = columnasPara(traza.tamanoTabla)
  const descartada = esDescartada(insercion)
  return (
    <section className="min-w-0" data-lado={traza.metodo}>
      <header className="mb-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {nombre}
          </h2>
          <p className="mt-0.5 truncate text-xs text-tinta-3">{regla}</p>
        </div>
        <div className="flex shrink-0 items-end gap-5 text-right">
          <div>
            <div className="text-2xs text-tinta-3">ocupadas</div>
            <div className="mono cifras text-sm text-tinta-2">
              {entero(estado.ocupadas)} / {entero(traza.tamanoTabla)}
            </div>
          </div>
          <div>
            <div className="text-2xs text-tinta-3">colisiones</div>
            <div className="mono cifras text-2xl font-bold leading-none text-tinta" data-colisiones={traza.metodo}>
              {entero(estado.colisiones)}
            </div>
          </div>
        </div>
      </header>

      {/* Las dos barras comparten escala: se ve cuál se dispara */}
      <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-superficie-2">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${escala > 0 ? (estado.colisiones / escala) * 100 : 0}%`, background: color }} />
      </div>

      {traza.tamanoTabla <= 64 ? (
        <TablaChica
          tamano={traza.tamanoTabla}
          columnas={columnas}
          kmers={estado.kmers}
          conteos={estado.conteos}
          camino={estado.camino}
          resultado={estado.resultado}
          destino={estado.destino}
        />
      ) : (
        <TablaGrande
          tamano={traza.tamanoTabla}
          columnas={columnas}
          kmers={estado.kmers}
          conteos={estado.conteos}
          camino={estado.camino}
          resultado={estado.resultado}
          destino={estado.destino}
        />
      )}

      <p className="mt-2 min-h-5 text-xs text-tinta-2">
        {descartada ? (
          'Este k-mer se descarta.'
        ) : (
          <>
            Empieza en la casilla <Num>{insercion.inicio}</Num> y, si choca, avanza de <Num>{insercion.paso}</Num> en <Num>{insercion.paso}</Num>
            <span className="text-tinta-3"> · </span>
            {relato(insercion, estado)}
          </>
        )}
      </p>
    </section>
  )
}

interface Props {
  id: string
  k: number
  limite: number
  alCambiarLimite: (limite: number) => void
  secuencia: string
}

/**
 * Inserción paso a paso: la ventana avanza por la secuencia y cada k-mer se
 * inserta a la vez en dos tablas, una con sondeo lineal y otra con doble hashing.
 * Usa las trazas del comando `trazakmers`.
 */
export function Insercion({ id, k, limite, alCambiarLimite, secuencia }: Props) {
  const lineal = useMotor('trazakmers', [id, String(k), 'lineal', String(limite)])
  const doble = useMotor('trazakmers', [id, String(k), 'doble', String(limite)])

  const cuadros = useMemo(
    () => (lineal.datos && doble.datos ? construirCuadros(lineal.datos.inserciones, doble.datos.inserciones) : []),
    [lineal.datos, doble.datos],
  )
  const escala = useMemo(
    () => (lineal.datos && doble.datos ? Math.max(colisionesTotales(lineal.datos.inserciones), colisionesTotales(doble.datos.inserciones)) : 0),
    [lineal.datos, doble.datos],
  )

  const reproductor = useReproductor(cuadros.length, { clave: cuadros, msPorPaso: 420 })
  const cuadro: Cuadro = cuadros[reproductor.paso] ?? { ins: 0, sub: 0 }

  const estadoLineal = useMemo(
    () => (lineal.datos ? estadoEn(lineal.datos.inserciones, lineal.datos.tamanoTabla, cuadro) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineal.datos, cuadro.ins, cuadro.sub],
  )
  const estadoDoble = useMemo(
    () => (doble.datos ? estadoEn(doble.datos.inserciones, doble.datos.tamanoTabla, cuadro) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doble.datos, cuadro.ins, cuadro.sub],
  )

  const error = lineal.error ?? doble.error
  if (error) {
    return (
      <ErrorDelMotorVisible
        error={error}
        alReintentar={() => {
          lineal.recargar()
          doble.recargar()
        }}
      />
    )
  }
  if (!lineal.datos || !doble.datos || !estadoLineal || !estadoDoble) return <Cargando texto="Pidiendo al motor la traza de las inserciones…" />
  if (cuadros.length === 0) return <div className="grid h-full place-items-center text-tinta-3">La secuencia es más corta que k: no hay ventanas que insertar.</div>

  const insLineal = lineal.datos.inserciones[cuadro.ins]
  const insDoble = doble.datos.inserciones[cuadro.ins]
  const descartada = esDescartada(insDoble)
  const totalVentanas = Math.max(0, secuencia.length - k + 1)
  const inserciones = Math.min(lineal.datos.inserciones.length, doble.datos.inserciones.length)

  const narracion = descartada ? (
    <span>
      Ventana <Num>{entero(insDoble.ventana + 1)}</Num>: <Num>{insDoble.kmer}</Num> tiene una base ambigua. El motor lo descarta y no toca las tablas.
    </span>
  ) : (
    <span>
      Ventana <Num>{entero(insDoble.ventana + 1)}</Num>: <Num>{insDoble.kmer}</Num>. <span style={{ color: COLOR_LINEAL }}>●</span> Lineal:{' '}
      {relato(insLineal, estadoLineal)}. <span style={{ color: COLOR_DOBLE }}>●</span> Doble: {relato(insDoble, estadoDoble)}.
    </span>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-3">
        <VentanaDeslizante secuencia={secuencia} ventana={insDoble.ventana} k={k} totalVentanas={totalVentanas} />

        <div className="flex h-12 items-center justify-center gap-4">
          <motion.div key={insDoble.ventana} initial={{ y: -22, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ duration: 0.22 }}>
            <Kmer texto={insDoble.kmer} tamano={k <= 4 ? 'l' : 'm'} />
          </motion.div>
          {!descartada && (
            <span className="mono text-xs text-tinta-2">
              hash = <span className="cifras text-tinta">{agruparDigitos(insDoble.hash ?? '—')}</span>
            </span>
          )}
          {descartada && <span className="text-xs text-aviso">descartado: tiene una base ambigua</span>}
        </div>

        <div className="grid grid-cols-2 gap-7">
          <Lado
            nombre="Sondeo lineal"
            regla="Si la casilla está ocupada por otro k-mer, prueba la siguiente (+1)."
            color={COLOR_LINEAL}
            traza={lineal.datos}
            insercion={insLineal}
            estado={estadoLineal}
            escala={escala}
          />
          <Lado
            nombre="Doble hashing"
            regla="Si está ocupada, salta un paso que depende del propio k-mer."
            color={COLOR_DOBLE}
            traza={doble.datos}
            insercion={insDoble}
            estado={estadoDoble}
            escala={escala}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-tinta-3">
          <span>Se animan las primeras</span>
          <Segmentos
            etiqueta="Ventanas a animar"
            tamano="s"
            valor={limite}
            alCambiar={alCambiarLimite}
            opciones={[
              { valor: 100, etiqueta: '100' },
              { valor: 400, etiqueta: '400' },
              { valor: 1000, etiqueta: '1000' },
            ]}
          />
          <span>
            ventanas de {entero(totalVentanas)} (ahora hay {entero(inserciones)}). Los totales de la secuencia completa están en «Tabla final».
          </span>
        </div>
      </div>

      <Controles
        reproductor={reproductor}
        narracion={narracion}
        extra={
          <Boton tamano="s" onClick={() => reproductor.irA(reproductor.total - 1)} disabled={reproductor.enElFinal}>
            Ir al final
          </Boton>
        }
      />
    </div>
  )
}
