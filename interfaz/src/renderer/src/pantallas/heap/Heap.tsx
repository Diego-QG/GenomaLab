import { useMemo, useState, type ReactNode } from 'react'
import type { OperacionHeap, ParKmer } from '@compartido/contrato'
import { Kmer } from '@/componentes/Base'
import { BarrasTop } from '@/componentes/graficos/BarrasTop'
import { Controles } from '@/componentes/reproductor/Controles'
import { useReproductor } from '@/componentes/reproductor/useReproductor'
import { Boton, Cabecera, Cargando, ErrorDelMotorVisible, Segmentos } from '@/componentes/ui'
import { useApp } from '@/estado/app'
import { clases, entero } from '@/lib/formato'
import { useMotor } from '@/motor/cliente'
import { Arbol, type Realce } from './Arbol'
import { construirCuadros, estadoEn, nivelDe, primerCuadroDeExtraccion, type Cuadro, type EstadoHeap } from './modelo'

const NIVELES_MAXIMOS = 6 // 63 nodos: lo que se puede leer en pantalla

function Num({ children }: { children: ReactNode }) {
  return <span className="mono cifras font-semibold text-hueso">{children}</span>
}

function Par({ par }: { par: ParKmer }) {
  return (
    <span className="whitespace-nowrap">
      <Kmer texto={par.kmer} tamano="s" /> <Num>({par.conteo})</Num>
    </span>
  )
}

function narrar(cuadro: Cuadro, operaciones: OperacionHeap[], estado: EstadoHeap, cuadros: Cuadro[], paso: number): ReactNode {
  if (cuadro.tipo === 'inicio') {
    return (
      <span>
        El motor ya contó los k-mers. Ahora los inserta uno por uno en un max-heap: el de mayor conteo siempre queda en la raíz, y de ahí sale el top n.
      </span>
    )
  }
  const operacion = operaciones[cuadro.op]
  if (cuadro.tipo === 'agregar') {
    const indice = estado.arreglo.length - 1
    const siguiente = cuadros[paso + 1]
    const seQueda = !(siguiente && siguiente.tipo === 'intercambio' && siguiente.op === cuadro.op)
    return (
      <span>
        Se inserta <Par par={operacion.par} />: entra al final del arreglo, en el índice <Num>{indice}</Num>.{' '}
        {indice === 0 ? 'Es el primero: queda como raíz.' : seQueda ? 'No es mayor que su padre, así que se queda ahí.' : 'Ahora se compara con su padre.'}
      </span>
    )
  }
  if (cuadro.tipo === 'quitar') {
    return (
      <span>
        <Par par={operacion.par} /> sale del heap: es el n.º <Num>{estado.extraidos.length}</Num> del top.{' '}
        {estado.arreglo.length > 1 ? 'El que quedó en la raíz tiene que bajar a su sitio.' : ''}
      </span>
    )
  }
  const antes = estado.antes
  if (!antes) return null
  if (cuadro.motivo === 'subir') {
    return (
      <span>
        <Par par={antes.enI} /> es mayor que su padre <Par par={antes.enJ} />: se intercambian y el nuevo sube al índice <Num>{cuadro.j}</Num>.
      </span>
    )
  }
  if (cuadro.motivo === 'raiz') {
    return (
      <span>
        Extraer el máximo: la raíz <Par par={antes.enI} /> se intercambia con el último, <Par par={antes.enJ} />, para poder quitarla del final.
      </span>
    )
  }
  return (
    <span>
      <Par par={antes.enI} /> es menor que su hijo mayor <Par par={antes.enJ} />: se intercambian y baja al índice <Num>{cuadro.j}</Num>.
    </span>
  )
}

/** El arreglo del heap como barras: se ve qué tramo del arreglo es cada nivel del árbol. */
function ArregloEnBarras({ arreglo, activos, maximo, limite }: { arreglo: readonly ParKmer[]; activos: readonly number[]; maximo: number; limite: number }) {
  const visibles = Math.min(arreglo.length, limite)
  const barras = []
  for (let i = 0; i < visibles; i++) {
    const par = arreglo[i]
    const nuevoNivel = i > 0 && nivelDe(i) !== nivelDe(i - 1)
    const activo = activos.includes(i)
    barras.push(
      <div
        key={i}
        title={`Índice ${i}: ${par.kmer} (${par.conteo})`}
        className={clases('flex h-full min-w-0 flex-1 items-end', nuevoNivel && 'ml-1.5 border-l border-linea pl-1.5')}
        style={{ maxWidth: 26 }}
      >
        <div
          className={clases('w-full rounded-t-[2px] transition-[height] duration-200', activo ? 'bg-hueso' : 'bg-fluor-3')}
          style={{ height: `${maximo > 0 ? Math.max(4, (par.conteo / maximo) * 100) : 4}%` }}
        />
      </div>,
    )
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-tinta-3">
        <span>
          El mismo heap como arreglo (índices 0 a {Math.max(0, visibles - 1)}
          {arreglo.length > visibles ? ` de ${arreglo.length - 1}` : ''}). Cada tramo separado es un nivel del árbol.
        </span>
        <code className="mono rounded bg-superficie-2 px-2 py-0.5 text-2xs text-tinta-2" title="Así se calculan los índices en MaxHeap.cpp">
          hijos de i: 2i+1 y 2i+2 · padre: (i−1)/2
        </code>
      </div>
      <div className="flex h-14 items-end gap-px rounded-md border border-linea bg-superficie px-2 pt-2" role="img" aria-label="Arreglo del heap">
        {barras}
      </div>
    </div>
  )
}

/**
 * Pantalla 6 — Heap: el max-heap que saca el top n, animado con la traza del
 * comando `heap` (cada inserción, cada intercambio y cada extracción).
 */
export function Heap() {
  const id = useApp((s) => s.virusActual)
  const [k, setK] = useState<3 | 6>(3)
  const [n, setN] = useState(5)
  const { datos, error, cargando, recargar } = useMotor('heap', id ? [id, String(k), String(n)] : null)

  const cuadros = useMemo(() => (datos ? construirCuadros(datos.operaciones) : []), [datos])
  const maximo = useMemo(() => (datos ? datos.operaciones.reduce((m, o) => Math.max(m, o.par.conteo), 0) : 0), [datos])
  const inicioExtracciones = useMemo(() => (datos ? primerCuadroDeExtraccion(cuadros, datos.operaciones) : -1), [cuadros, datos])

  const reproductor = useReproductor(cuadros.length, { clave: cuadros, msPorPaso: 700 })
  const estado = useMemo(() => (datos ? estadoEn(datos.operaciones, cuadros, reproductor.paso) : null), [datos, cuadros, reproductor.paso])

  if (!id) return <div className="grid h-full place-items-center text-tinta-3">Elige un virus en el Explorador.</div>

  let escena: ReactNode
  let narracion: ReactNode
  if (error) {
    escena = <ErrorDelMotorVisible error={error} alReintentar={recargar} />
  } else if (cargando || !datos || !estado) {
    escena = <Cargando texto="Pidiendo al motor la traza del heap…" />
  } else {
    const cuadro: Cuadro = cuadros[reproductor.paso] ?? { tipo: 'inicio' }
    const inserciones = datos.operaciones.filter((o) => o.op === 'insertar').length
    const niveles = Math.max(1, Math.min(NIVELES_MAXIMOS + (inserciones <= 127 ? 1 : 0), Math.ceil(Math.log2(inserciones + 1))))

    let activos: number[] = []
    let realce: Realce = null
    if (cuadro.tipo === 'intercambio') {
      activos = [cuadro.i, cuadro.j]
      realce = 'intercambio'
    } else if (cuadro.tipo === 'agregar') {
      activos = [estado.arreglo.length - 1]
      realce = 'nuevo'
    }
    const extraido = cuadro.tipo === 'quitar' ? datos.operaciones[cuadro.op].par.kmer : null
    const operacion = cuadro.tipo === 'inicio' ? null : datos.operaciones[cuadro.op]
    const fueraDeVista = activos.length > 0 && activos.every((i) => i >= 2 ** niveles - 1)
    narracion = narrar(cuadro, datos.operaciones, estado, cuadros, reproductor.paso)

    escena = (
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_19rem] gap-7 px-6 pb-3">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="relative min-h-0 flex-1">
            <Arbol arreglo={estado.arreglo} activos={activos} realce={realce} niveles={niveles} maximo={maximo} extraido={extraido} />
            {estado.arreglo.length === 0 && (
              <div className="absolute inset-0 grid place-items-center text-tinta-3">
                {reproductor.paso === 0 ? 'El heap está vacío. Pulsa reproducir o avanza un paso.' : 'El heap quedó vacío.'}
              </div>
            )}
            {fueraDeVista && (
              <div className="absolute right-0 top-0 rounded-md border border-linea bg-superficie px-3 py-1.5 text-xs text-tinta-2">
                Este intercambio ocurre más abajo de lo que se dibuja (índices {activos.join(' y ')}).
              </div>
            )}
          </div>
          <ArregloEnBarras arreglo={estado.arreglo} activos={activos} maximo={maximo} limite={2 ** niveles - 1} />
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto">
          <section>
            <h2 className="text-sm">Top {datos.n}: lo que va saliendo</h2>
            <p className="mb-3 mt-0.5 text-xs text-tinta-3">Cada extracción saca la raíz, que es el máximo.</p>
            <BarrasTop datos={datos.top} visibles={estado.extraidos.length} filas={datos.top.length} />
          </section>
          <section className="space-y-2 border-t border-linea pt-4 text-xs text-tinta-2">
            <div className="flex justify-between">
              <span>Elementos en el heap</span>
              <span className="mono cifras text-tinta" data-tamano-heap>
                {entero(estado.arreglo.length)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Operación</span>
              <span className="mono cifras text-tinta">
                {cuadro.tipo === 'inicio' ? '—' : `${entero(cuadro.op + 1)} de ${entero(datos.operaciones.length)}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Ahora</span>
              <span className="flex items-center gap-1.5 text-tinta">
                {operacion ? (
                  <>
                    {operacion.op === 'insertar' ? 'insertar' : 'extraer el máximo'}
                    <Kmer texto={operacion.par.kmer} tamano="xs" />
                  </>
                ) : (
                  'por empezar'
                )}
              </span>
            </div>
            <p className="pt-1 leading-snug text-tinta-3">Más claro = conteo más alto. En un max-heap ningún hijo es mayor que su padre.</p>
          </section>
        </aside>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Cabecera
        titulo="Heap"
        descripcion="Para sacar los k-mers más frecuentes, el motor los mete en un max-heap guardado en un vector y extrae la raíz n veces."
      >
        <Segmentos
          etiqueta="Tamaño del k-mer"
          valor={k}
          alCambiar={setK}
          opciones={[
            { valor: 3, etiqueta: 'k = 3', titulo: 'Hasta 64 k-mers distintos' },
            { valor: 6, etiqueta: 'k = 6', titulo: 'Hasta 4096 k-mers distintos' },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-tinta-3">
          Top
          <Segmentos
            etiqueta="Cuántos extraer"
            valor={n}
            alCambiar={setN}
            opciones={[
              { valor: 5, etiqueta: '5' },
              { valor: 10, etiqueta: '10' },
              { valor: 20, etiqueta: '20' },
            ]}
          />
        </label>
      </Cabecera>

      <div className="min-h-0 flex-1">{escena}</div>

      <Controles
        reproductor={reproductor}
        narracion={narracion}
        extra={
          <Boton
            tamano="s"
            id="saltar-a-extracciones"
            disabled={inicioExtracciones < 0 || reproductor.paso >= inicioExtracciones - 1}
            onClick={() => reproductor.irA(inicioExtracciones - 1)}
            title="Salta al momento en que el heap ya está armado y empiezan las extracciones"
          >
            Ir a las extracciones
          </Boton>
        }
      />
    </div>
  )
}
