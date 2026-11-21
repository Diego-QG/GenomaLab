import { useRef } from 'react'
import { Columns2, ListTree, Rows3, Users, Waypoints } from 'lucide-react'
import { Boton, Cargando, ChipGrupo, Dato, ErrorDelMotorVisible } from '@/componentes/ui'
import { useApp } from '@/estado/app'
import { BASES, COLOR_BASE, SIGNIFICADO_IUPAC, TINTA_SOBRE_BASE, infoDeGrupo } from '@/lib/colores'
import { decimal, entero } from '@/lib/formato'
import { useMotor } from '@/motor/cliente'
import { Secuencia, type ControlSecuencia } from './Secuencia'

/**
 * Composición por base. Los conteos los da el motor con su propia tabla de k-mers
 * usando k = 1 (`kmers <id> 1 4`); aquí solo se dibujan como partes de un todo.
 */
function Composicion({ id }: { id: string }) {
  const { datos } = useMotor('kmers', [id, '1', '4'])
  if (!datos) return null // si el motor no responde con k = 1, la barra simplemente no aparece
  const conteo = new Map(datos.top.map((p) => [p.kmer, p.conteo]))
  const total = BASES.reduce((suma, b) => suma + (conteo.get(b) ?? 0), 0)
  if (total === 0) return null

  return (
    <div className="min-w-[22rem] flex-1">
      <div className="mb-1.5 text-xs text-tinta-3">Composición (bases válidas)</div>
      <div className="flex h-7 gap-0.5" role="img" aria-label={BASES.map((b) => `${b}: ${entero(conteo.get(b) ?? 0)}`).join(', ')}>
        {BASES.map((b) => {
          const n = conteo.get(b) ?? 0
          const parte = (n / total) * 100
          if (n === 0) return null
          return (
            <div
              key={b}
              className="mono flex items-center overflow-hidden rounded-[4px] pl-2 text-xs font-bold"
              style={{ width: `${parte}%`, background: COLOR_BASE[b], color: TINTA_SOBRE_BASE }}
              title={`${b}: ${entero(n)} bases (${decimal(parte, 1)} %)`}
            >
              {parte >= 9 && (
                <>
                  {b}
                  <span className="cifras ml-1.5 font-medium">{decimal(parte, 1)} %</span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Pantalla 3 — Detalle de un virus: sus datos, la secuencia completa coloreada
 * y los accesos a k-mers, heap, grafo y comparación.
 */
export function Detalle() {
  const id = useApp((s) => s.virusActual)
  const ir = useApp((s) => s.ir)
  const { datos, error, cargando, recargar } = useMotor('virus', id ? [id] : null)
  const control = useRef<ControlSecuencia>(null)

  if (!id) return <div className="grid h-full place-items-center text-tinta-3">Elige un virus en el Explorador.</div>
  if (error) return <ErrorDelMotorVisible error={error} alReintentar={recargar} />
  if (cargando || !datos) return <Cargando texto="Pidiendo la secuencia al motor…" />

  const grupo = infoDeGrupo(datos.grupo)

  return (
    <div className="flex h-full flex-col px-6 pb-5 pt-5">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h1 className="mono select-text break-all text-2xl leading-tight" style={{ fontStretch: '87.5%', letterSpacing: 0 }}>
            {datos.id}
          </h1>
          <div className="mt-2 flex items-center gap-2.5 text-sm text-tinta-2">
            <ChipGrupo grupo={datos.grupo} />
            <span>{grupo.descripcion}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Boton icono={<Rows3 size={15} />} onClick={() => ir('kmers')}>
            K-mers
          </Boton>
          <Boton icono={<ListTree size={15} />} onClick={() => ir('heap')}>
            Heap
          </Boton>
          <Boton icono={<Waypoints size={15} />} onClick={() => ir('grafo')}>
            Grafo
          </Boton>
          <Boton icono={<Columns2 size={15} />} onClick={() => ir('comparar')}>
            Comparar
          </Boton>
          <Boton icono={<Users size={15} />} onClick={() => ir('parecidos')} title="¿A quién se parece?">
            Parecidos
          </Boton>
        </div>
      </header>

      <section className="mt-5 flex shrink-0 flex-wrap items-end gap-x-10 gap-y-4 border-y border-linea py-4">
        <Dato etiqueta="Longitud">
          {entero(datos.longitud)} <span className="text-sm font-normal text-tinta-3">bases</span>
        </Dato>
        <Dato etiqueta="Contenido GC" titulo="Porcentaje de G + C sobre las bases válidas">
          {decimal(datos.gc, 2)} <span className="text-sm font-normal text-tinta-3">%</span>
        </Dato>
        <Dato etiqueta="Bases ambiguas">{entero(datos.ambiguas.length)}</Dato>
        <Composicion id={datos.id} />
      </section>

      {datos.ambiguas.length > 0 && (
        <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 text-xs">
          <span className="text-tinta-3">Ambiguas (el motor las descarta al contar k-mers):</span>
          {datos.ambiguas.map((a) => (
            <button
              key={a.pos}
              type="button"
              onClick={() => control.current?.irA(a.pos)}
              title={`${a.letra} = ${SIGNIFICADO_IUPAC[a.letra] ?? 'base ambigua'}. Clic para ir a la posición ${a.pos}`}
              className="mono cifras rounded-full border border-linea-fuerte px-2 py-px text-tinta-2 hover:border-hueso hover:text-tinta"
            >
              <span className="font-bold text-tinta">{a.letra}</span> en {entero(a.pos)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <Secuencia secuencia={datos.secuencia} ambiguas={datos.ambiguas} control={control} />
      </div>
    </div>
  )
}
