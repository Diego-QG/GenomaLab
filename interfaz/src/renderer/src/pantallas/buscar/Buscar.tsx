import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { LayoutGroup, motion } from 'motion/react'
import { Search } from 'lucide-react'
import type { RespuestaBuscar } from '@compartido/contrato'
import { NumeroRodante } from '@/componentes/NumeroRodante'
import { Controles } from '@/componentes/reproductor/Controles'
import { useReproductor } from '@/componentes/reproductor/useReproductor'
import { Boton, Cabecera, Cargando, ErrorDelMotorVisible } from '@/componentes/ui'
import { useApp, useNombreArchivo } from '@/estado/app'
import { agruparDigitos, clases, plural } from '@/lib/formato'
import { pedir, useEpocaDelMotor } from '@/motor/cliente'
import { Mapa } from './Mapa'
import { Tira, type EstadoCasilla } from './Tira'

type TipoCuadro = 'inicio' | 'letra' | 'modulo' | 'caida' | 'sondeo'

interface Cuadro {
  tipo: TipoCuadro
  indice: number
}

/** Duración de cada tipo de paso a velocidad 1× (ms). */
const DURACION: Record<TipoCuadro, number> = { inicio: 1000, letra: 460, modulo: 1700, caida: 1200, sondeo: 1700 }

/** Por encima de este valor, h × 31 ya no cabe en un unsigned long long (64 bits). */
const LIMITE_ANTES_DE_DESBORDAR = 595056260442243600n

function seDesborda(previo: string): boolean {
  try {
    return BigInt(previo) >= LIMITE_ANTES_DE_DESBORDAR
  } catch {
    return false
  }
}

/** La película de una búsqueda: inicio, una letra por paso, el módulo, la caída y cada comparación. */
function construirCuadros(r: RespuestaBuscar): Cuadro[] {
  return [
    { tipo: 'inicio', indice: 0 },
    ...r.hashPasos.map((_, i): Cuadro => ({ tipo: 'letra', indice: i })),
    { tipo: 'modulo', indice: 0 },
    { tipo: 'caida', indice: 0 },
    ...r.pasos.map((_, j): Cuadro => ({ tipo: 'sondeo', indice: j })),
  ]
}

/** Números e IDs dentro de la narración. */
function Num({ children }: { children: ReactNode }) {
  return <span className="mono cifras font-semibold text-hueso">{children}</span>
}

/** Palabras que hay que destacar en la narración. */
function Clave({ children }: { children: ReactNode }) {
  return <strong className="font-bold text-hueso">{children}</strong>
}

function narrar(r: RespuestaBuscar, cuadro: Cuadro): ReactNode {
  switch (cuadro.tipo) {
    case 'inicio':
      return (
        <span>
          Se busca <Num>{r.id}</Num>. Primero hay que convertirlo en un número: la función hash empieza con <Num>h = 0</Num> y procesa una letra
          a la vez.
        </span>
      )
    case 'letra': {
      const { letra, valor } = r.hashPasos[cuadro.indice]
      const previo = cuadro.indice === 0 ? '0' : r.hashPasos[cuadro.indice - 1].valor
      return (
        <span>
          Letra <Num>«{letra}»</Num>, que vale <Num>{letra.charCodeAt(0)}</Num>:{' '}
          <span className="mono cifras text-tinta-2">
            h = {agruparDigitos(previo)} × 31 + {letra.charCodeAt(0)} →
          </span>{' '}
          <Num>{agruparDigitos(valor)}</Num>
          {seDesborda(previo) && <span className="text-tinta-2"> (el producto no cabe en 64 bits: el número da la vuelta, como en C++)</span>}
        </span>
      )
    }
    case 'modulo':
      return (
        <span>
          El hash se divide entre el tamaño de la tabla, <Num>{r.tamano}</Num>. El resto de esa división, <Num>{r.inicio}</Num>, es la casilla
          donde empieza la búsqueda.
        </span>
      )
    case 'caida':
      return (
        <span>
          El ID cae en la casilla <Num>{r.inicio}</Num>. Ahora toca comparar lo que hay ahí con lo que se busca.
        </span>
      )
    case 'sondeo': {
      const paso = r.pasos[cuadro.indice]
      const comparaciones = plural(cuadro.indice + 1, 'comparación', 'comparaciones')
      if (!paso.ocupada) {
        return (
          <span>
            Casilla <Num>{paso.pos}</Num>: está vacía. Si el ID existiera, estaría aquí o antes, así que <Clave>no está en la tabla</Clave>.
          </span>
        )
      }
      if (paso.igual) {
        return (
          <span>
            Casilla <Num>{paso.pos}</Num>: guarda justo el ID buscado. <Clave>Encontrado</Clave> tras {comparaciones}.
          </span>
        )
      }
      const esUltimo = cuadro.indice === r.pasos.length - 1
      return (
        <span>
          Casilla <Num>{paso.pos}</Num>: guarda <Num>{paso.idEnCasilla}</Num>, que no es el buscado.{' '}
          {esUltimo ? 'Ya se revisaron todas las casillas: no está en la tabla.' : 'Colisión: con sondeo lineal se pasa a la casilla siguiente (+1).'}
        </span>
      )
    }
  }
}

interface PropsZona {
  numero: number
  titulo: string
  estado: 'pendiente' | 'activa' | 'hecha'
  /** Título y contenido en la misma línea (para zonas de un solo renglón). */
  enLinea?: boolean
  children: ReactNode
}

function Zona({ numero, titulo, estado, enLinea = false, children }: PropsZona) {
  return (
    <section className={clases('flex gap-4 transition-opacity duration-300', estado === 'pendiente' && 'opacity-35', estado === 'hecha' && 'opacity-75')}>
      <div className="flex flex-col items-center">
        <span
          className={clases(
            'mono grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold',
            estado === 'activa' ? 'border-hueso bg-hueso text-fondo' : 'border-linea-fuerte text-tinta-2',
          )}
        >
          {numero}
        </span>
        <span className="mt-1 w-px flex-1 bg-linea" />
      </div>
      {enLinea ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 pb-3">
          <h2 className="flex h-7 shrink-0 items-center text-sm text-tinta">{titulo}</h2>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      ) : (
        <div className="min-w-0 flex-1 pb-3">
          <h2 className="mb-1.5 flex h-7 items-center text-sm text-tinta">{titulo}</h2>
          {children}
        </div>
      )}
    </section>
  )
}

const ARCHIVO_DEL_PROYECTO = 'HIV2_ALL_2021_env_DNA.2000.fasta'

/**
 * Pantalla 4 — Buscar (laboratorio de hash). Anima la traza del comando
 * `buscar <id>`: el hash letra por letra, la casilla inicial y las comparaciones.
 */
export function Buscar() {
  const resumen = useApp((s) => s.resumen)
  const virusActual = useApp((s) => s.virusActual)
  const nombreArchivo = useNombreArchivo()

  const [texto, setTexto] = useState(virusActual ?? '')
  const [resultado, setResultado] = useState<RespuestaBuscar | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [turno, setTurno] = useState(0)
  const [auto, setAuto] = useState(false)

  const ocupadas = useMemo(() => new Map((resumen?.tabla?.ocupadas ?? []).map((o) => [o.pos, o.id])), [resumen])
  const cuadros = useMemo(() => (resultado ? construirCuadros(resultado) : []), [resultado])

  const reproductor = useReproductor(cuadros.length, {
    clave: turno,
    autoinicio: auto,
    msPorPaso: (paso) => DURACION[cuadros[paso]?.tipo ?? 'inicio'],
  })

  const buscar = useCallback(async (id: string, reproducir: boolean): Promise<void> => {
    const limpio = id.trim()
    if (!limpio) return
    setBuscando(true)
    setError(null)
    setTexto(limpio)
    try {
      // Cada búsqueda es una ejecución real del motor
      const respuesta = await pedir('buscar', [limpio], { fresco: true })
      setResultado(respuesta)
      setAuto(reproducir)
      setTurno((t) => t + 1)
    } catch (e) {
      setResultado(null) // la traza anterior ya no corresponde a lo que se pidió
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBuscando(false)
    }
  }, [])

  // Al entrar, la escena ya muestra una búsqueda lista para reproducir. Si cambia la
  // fuente de los datos (otro archivo u otro motor), la búsqueda en pantalla se repite con la nueva.
  const epoca = useEpocaDelMotor()
  useEffect(() => {
    const id = texto.trim() || virusActual
    if (id) void buscar(id, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoca])

  if (!resumen) return null

  const alEnviar = (e: FormEvent): void => {
    e.preventDefault()
    void buscar(texto, true)
  }

  const alAzar = (): void => {
    const elegido = resumen.virus[Math.floor(Math.random() * resumen.virus.length)]
    if (elegido) void buscar(elegido.id, true)
  }

  const cuadro: Cuadro = cuadros[reproductor.paso] ?? { tipo: 'inicio', indice: 0 }
  const fase = cuadro.tipo === 'inicio' || cuadro.tipo === 'letra' ? 1 : cuadro.tipo === 'modulo' ? 2 : 3
  const estadoDe = (zona: number): 'pendiente' | 'activa' | 'hecha' => (zona === fase ? 'activa' : zona < fase ? 'hecha' : 'pendiente')

  let escena: ReactNode = <Cargando texto="Pidiendo la traza de la búsqueda al motor…" />
  if (error && !resultado) {
    escena = <ErrorDelMotorVisible error={error} alReintentar={() => void buscar(texto, false)} />
  } else if (resultado) {
    const r = resultado
    const letras = r.hashPasos.length
    const hechas = cuadro.tipo === 'inicio' ? 0 : cuadro.tipo === 'letra' ? cuadro.indice + 1 : letras
    const h = hechas === 0 ? '0' : hechas < letras ? r.hashPasos[hechas - 1].valor : r.hash
    const enTabla = cuadro.tipo === 'caida' || cuadro.tipo === 'sondeo'
    const sondeo = cuadro.tipo === 'sondeo' ? cuadro.indice : -1

    const visitadas = new Map<number, EstadoCasilla>()
    for (let j = 0; j <= sondeo; j++) {
      const paso = r.pasos[j]
      visitadas.set(paso.pos, !paso.ocupada ? 'vacia-final' : paso.igual ? 'igual' : 'distinta')
    }
    const centro = sondeo >= 0 ? r.pasos[sondeo].pos : r.inicio
    const estadoCentro = visitadas.get(centro)
    const terminado = reproductor.enElFinal && sondeo >= 0

    escena = (
      <LayoutGroup>
        <Zona numero={1} titulo="El ID se convierte en un número" estado={estadoDe(1)}>
          <div className="flex flex-wrap gap-1" aria-label={`Letras de ${r.id}`}>
            {r.hashPasos.map((p, i) => (
              <span
                key={i}
                className={clases(
                  'mono grid h-8 w-7 place-items-center rounded-md border text-sm font-bold transition-all duration-200',
                  i === hechas - 1 && cuadro.tipo === 'letra'
                    ? 'z-10 scale-[1.18] border-hueso bg-hueso text-fondo'
                    : i < hechas
                      ? 'border-linea bg-superficie-2 text-tinta'
                      : 'border-linea text-tinta-3',
                )}
              >
                {p.letra}
              </span>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="mono text-lg text-tinta-3">h =</span>
            <NumeroRodante valor={h} className="text-[1.75rem] font-bold leading-none text-tinta" />
            <code className="mono ml-auto rounded bg-superficie-2 px-2 py-1 text-xs text-tinta-2" title="La línea de hashTexto() en TablaVirus.cpp">
              h = h * 31 + c;
            </code>
          </div>
        </Zona>

        <Zona numero={2} titulo="El número elige una casilla" estado={estadoDe(2)} enLinea>
          <div className="mono flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
            <span className="cifras text-tinta-2">{agruparDigitos(r.hash)}</span>
            <span className="text-tinta-3">mod</span>
            <span className="cifras text-tinta-2">{r.tamano}</span>
            <span className="text-tinta-3">=</span>
            {fase === 1 && <span className="text-tinta-3">?</span>}
            {fase === 2 && (
              <motion.span layoutId="casilla-inicial" className="cifras rounded-md bg-hueso px-2.5 py-0.5 text-lg font-bold text-fondo">
                {r.inicio}
              </motion.span>
            )}
            {fase === 3 && <span className="cifras text-lg font-bold text-tinta">{r.inicio}</span>}
            <code className="ml-auto rounded bg-superficie-2 px-2 py-1 text-xs text-tinta-2" title="Así elige la casilla TablaVirus::buscar()">
              pos = hashTexto(id) % casillas.size();
            </code>
          </div>
        </Zona>

        <Zona numero={3} titulo="Comparar y, si no es, saltar a la siguiente" estado={estadoDe(3)}>
          <div className="flex h-8 items-end justify-center gap-3 pb-1.5">
            {enTabla && (
              <>
                <motion.span layoutId="casilla-inicial" className="mono cifras rounded-md bg-hueso px-2.5 py-0.5 text-sm font-bold text-fondo">
                  casilla {centro}
                </motion.span>
                <span className="text-sm text-tinta-2">
                  {estadoCentro === 'igual' && 'es el ID buscado'}
                  {estadoCentro === 'distinta' && 'no es el ID buscado'}
                  {estadoCentro === 'vacia-final' && 'no hay nada: la búsqueda termina'}
                  {estadoCentro === undefined && 'aquí empieza la búsqueda'}
                </span>
              </>
            )}
          </div>
          <Tira tamano={r.tamano} ocupadas={ocupadas} centro={centro} visitadas={visitadas} activa={enTabla} />

          <div className="mt-2 flex items-center justify-between text-xs text-tinta-3">
            <span>
              {resumen.tabla
                ? `La tabla completa: ${r.tamano} casillas, ${ocupadas.size} ocupadas. Haz clic en una ocupada para buscar su ID.`
                : `La tabla completa: ${r.tamano} casillas. El motor no envió cuáles están ocupadas (falta «tabla» en «resumen»).`}
            </span>
            <span
              id="veredicto"
              className={clases('text-sm font-semibold', !terminado && 'invisible', r.encontrado ? 'text-bien' : 'text-hueso')}
              aria-live="polite"
            >
              {r.encontrado
                ? `Encontrado en la casilla ${r.posFinal} tras ${plural(r.pasos.length, 'comparación', 'comparaciones')}`
                : `No está en la tabla (${plural(r.pasos.length, 'casilla revisada', 'casillas revisadas')})`}
            </span>
          </div>
          <div className="mt-2">
            <Mapa
              tamano={r.tamano}
              ocupadas={ocupadas}
              visitadas={visitadas}
              inicio={fase >= 2 ? r.inicio : null}
              actual={enTabla ? centro : null}
              alElegir={(id) => void buscar(id, true)}
            />
          </div>
        </Zona>
      </LayoutGroup>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Cabecera
        titulo="Buscar un virus por ID"
        descripcion="La tabla hash por dentro: cómo un ID se vuelve un número, en qué casilla cae y cómo se resuelven las colisiones saltando de una en una."
      >
        <form onSubmit={alEnviar} className="flex items-center gap-2">
          <label className="flex h-9 w-[22rem] items-center gap-2 rounded-md border border-linea-fuerte bg-superficie px-3 focus-within:border-hueso">
            <Search size={15} className="shrink-0 text-tinta-3" />
            <input
              id="id-a-buscar"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              list="ids-de-virus"
              placeholder="Escribe un ID, exista o no"
              spellCheck={false}
              autoComplete="off"
              className="mono h-full min-w-0 flex-1 bg-transparent text-xs text-tinta outline-none placeholder:font-sans placeholder:text-sm placeholder:text-tinta-3"
            />
          </label>
          <datalist id="ids-de-virus">
            {resumen.virus.map((v) => (
              <option key={v.id} value={v.id} />
            ))}
          </datalist>
          <Boton id="boton-buscar" type="submit" variante="primario" disabled={buscando || texto.trim() === ''}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </Boton>
        </form>
      </Cabecera>

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-6 pb-3 text-xs">
        <span className="text-tinta-3">Prueba con</span>
        {virusActual && (
          <Boton tamano="s" onClick={() => void buscar(virusActual, true)}>
            el virus en estudio
          </Boton>
        )}
        <Boton tamano="s" onClick={alAzar}>
          un virus al azar
        </Boton>
        {nombreArchivo === ARCHIVO_DEL_PROYECTO && (
          <Boton tamano="s" onClick={() => void buscar('A.PT.03.P3_5.KX791217', true)} title="Este ID cae en una zona llena de la tabla: necesita varias comparaciones">
            uno con varias colisiones
          </Boton>
        )}
        <Boton tamano="s" data-ejemplo="GRIPE" onClick={() => void buscar('GRIPE', true)} title="Un ID que no está en el archivo">
          GRIPE (no existe)
        </Boton>
        <Boton tamano="s" onClick={() => void buscar('HOLA', true)} title="Un ID que no está en el archivo">
          HOLA (no existe)
        </Boton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-1">{escena}</div>

      <Controles reproductor={reproductor} narracion={resultado ? narrar(resultado, cuadro) : undefined} />
    </div>
  )
}
