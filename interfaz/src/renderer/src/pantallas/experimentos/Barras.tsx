import { useRef } from 'react'
import { motion } from 'motion/react'
import { entero } from '@/lib/formato'
import { useMedida } from '@/lib/useMedida'
import { COLOR_METODO, casillasDe, conDecimales, esFinito, geometriaDePanel, type PanelK } from './modelo'

const SALIDA = [0.16, 1, 0.3, 1] as const

/**
 * Gráfico de un k: barra del promedio de colisiones por virus para cada método,
 * con los virus como puntos al lado. La escala es propia de este panel.
 * El SVG va en posición absoluta para que su alto lo decida el flex y no al revés.
 */
function Grafico({ panel }: { panel: PanelK }) {
  const caja = useRef<HTMLDivElement>(null)
  const { ancho, alto } = useMedida(caja)
  const g = ancho > 0 && alto > 0 ? geometriaDePanel(panel, ancho, alto) : null

  return (
    <div ref={caja} className="relative min-h-0 flex-1">
      {g && (
        <svg
          width={g.ancho}
          height={g.alto}
          className="absolute inset-0 block overflow-visible"
          role="img"
          aria-label={`k = ${panel.k}: promedio de colisiones por virus, sondeo lineal ${conDecimales(panel.lineal.promedio)} y doble hashing ${conDecimales(panel.doble.promedio)}`}
        >
          {g.marcas.map((m) => (
            <g key={m.texto}>
              <line x1={g.izquierda} x2={g.derecha} y1={m.y} y2={m.y} className="stroke-linea" strokeDasharray={Math.abs(m.y - g.base) < 0.5 ? undefined : '2 3'} />
              <text x={g.izquierda - 8} y={m.y + 3.5} textAnchor="end" className="fill-tinta-3 font-mono text-[10px]">
                {m.texto}
              </text>
            </g>
          ))}
          <line x1={g.izquierda} x2={g.derecha} y1={g.base} y2={g.base} className="stroke-linea-fuerte" />

          {g.fantasma && (
            <rect
              x={g.fantasma.x + 0.5}
              y={g.fantasma.y + 0.5}
              width={Math.max(0, g.fantasma.ancho - 1)}
              height={Math.max(0, g.fantasma.alto - 1)}
              rx={2}
              fill={COLOR_METODO.lineal}
              fillOpacity={0.05}
              stroke={COLOR_METODO.lineal}
              strokeOpacity={0.7}
              strokeDasharray="3 3"
            >
              <title>Hasta aquí llegaba el sondeo lineal</title>
            </rect>
          )}

          {g.columnas.map((c, i) => (
            <g key={c.metodo}>
              {c.barra && (
                <motion.rect
                  x={c.barra.x}
                  y={c.barra.y}
                  width={c.barra.ancho}
                  height={c.barra.alto}
                  rx={2}
                  fill={c.color}
                  style={{ originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: SALIDA }}
                >
                  <title>{`${c.nombre}, k = ${panel.k}: ${conDecimales(panel[c.metodo].promedio)} colisiones por virus en promedio`}</title>
                </motion.rect>
              )}
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.25 + i * 0.08 }}>
                {c.puntos.map((p, j) => (
                  <circle key={`${j}:${p.id}`} cx={p.x} cy={p.y} r={g.radioPunto} fill={c.color} fillOpacity={0.55}>
                    <title>{`${p.id}: ${entero(p.valor)} colisiones (${c.nombre.toLowerCase()})`}</title>
                  </circle>
                ))}
              </motion.g>
              {c.etiqueta && (
                <text x={c.etiqueta.x} y={c.etiqueta.y} textAnchor="middle" className="fill-tinta font-mono text-[11px] font-semibold">
                  {c.etiqueta.texto}
                </text>
              )}
              <text x={c.centro} y={g.yNombre} textAnchor="middle" className="fill-tinta-2 text-[11.5px]">
                {c.nombre}
              </text>
            </g>
          ))}

          {g.reduccion && (
            <text x={g.reduccion.x} y={g.reduccion.y} textAnchor="middle" className="fill-bien font-mono text-[11px] font-semibold">
              {g.reduccion.texto}
            </text>
          )}
        </svg>
      )}
    </div>
  )
}

/** Tarjeta de un k: título, % de reducción y el gráfico. */
export function PanelDeK({ panel }: { panel: PanelK }) {
  const hayReduccion = esFinito(panel.reduccion)
  const menos = panel.reduccion >= 0
  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-xl border border-linea bg-superficie px-4 pb-2.5 pt-3" aria-label={`Colisiones con k = ${panel.k}`}>
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm">k = {panel.k}</h2>
          <p className="mt-0.5 truncate text-2xs text-tinta-3">
            {entero(casillasDe(panel.k))} casillas · escala propia
          </p>
        </div>
        {hayReduccion && (
          <div className="shrink-0 text-right" title="(lineal − doble) / lineal × 100, con las colisiones totales">
            <div className={`mono cifras text-lg font-semibold leading-tight ${menos ? 'text-bien' : 'text-mal'}`}>
              {conDecimales(Math.abs(panel.reduccion), 1)} %
            </div>
            <div className="text-2xs text-tinta-3">{menos ? 'menos con doble hashing' : 'más con doble hashing'}</div>
          </div>
        )}
      </div>
      <Grafico panel={panel} />
    </section>
  )
}
