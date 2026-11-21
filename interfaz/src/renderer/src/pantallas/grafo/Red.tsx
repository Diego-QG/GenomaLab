import { useMemo, useState } from 'react'
import type { CeldaSenalada } from '@/componentes/graficos/MapaDeCalor'
import { COLOR_AMBIGUA, COLOR_BASE } from '@/lib/colores'
import { decimal } from '@/lib/formato'

const RADIO = 124
const RADIO_NODO = 15

interface Arco {
  i: number
  j: number
  peso: number
}

interface Props {
  matriz: readonly (readonly number[])[]
  nombres: readonly string[]
  /** Arco señalado en el mapa de calor (fila = origen, columna = destino). */
  senalada: CeldaSenalada | null
  alSenalar: (celda: CeldaSenalada | null) => void
  /** Cuántos arcos dibujar, empezando por los más pesados. */
  cuantos: number
}

function posicion(i: number, n: number, radio = RADIO): [number, number] {
  const angulo = (-90 + (i * 360) / n) * (Math.PI / 180)
  return [Math.cos(angulo) * radio, Math.sin(angulo) * radio]
}

/** Trazo de un arco dirigido i → j, curvado para que ida y vuelta no se pisen. */
function trazo(i: number, j: number, n: number): string {
  const [x1, y1] = posicion(i, n)
  if (i === j) {
    // Lazo: la pareja se apunta a sí misma
    const [cx, cy] = posicion(i, n, RADIO + RADIO_NODO + 9)
    return `M ${cx - 9} ${cy} a 9 9 0 1 1 18 0 a 9 9 0 1 1 -18 0`
  }
  const [x2, y2] = posicion(j, n)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const largo = Math.hypot(dx, dy) || 1
  // Punto de control: hacia el centro y un poco hacia un lado (según el sentido)
  const cx = mx * 0.62 + (-dy / largo) * 16
  const cy = my * 0.62 + (dx / largo) * 16
  const haciaC1 = Math.hypot(cx - x1, cy - y1) || 1
  const haciaC2 = Math.hypot(cx - x2, cy - y2) || 1
  const sx = x1 + ((cx - x1) / haciaC1) * (RADIO_NODO + 2)
  const sy = y1 + ((cy - y1) / haciaC1) * (RADIO_NODO + 2)
  const ex = x2 + ((cx - x2) / haciaC2) * (RADIO_NODO + 6)
  const ey = y2 + ((cy - y2) / haciaC2) * (RADIO_NODO + 6)
  return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`
}

/**
 * El grafo como red: 16 nodos (las parejas) en círculo y flechas cuyo grosor es
 * el peso del arco. Solo dibuja; los pesos son la matriz que entregó el motor.
 */
export function Red({ matriz, nombres, senalada, alSenalar, cuantos }: Props) {
  const [nodo, setNodo] = useState<number | null>(null)
  const n = nombres.length

  const { arcos, maximo } = useMemo(() => {
    const lista: Arco[] = []
    let tope = 0
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const peso = matriz[i]?.[j] ?? 0
        if (peso > 0) lista.push({ i, j, peso })
        if (peso > tope) tope = peso
      }
    }
    lista.sort((a, b) => b.peso - a.peso)
    return { arcos: lista, maximo: tope || 1 }
  }, [matriz, n])

  const visibles = arcos.slice(0, cuantos)
  const elegido = senalada ? arcos.find((a) => a.i === senalada.fila && a.j === senalada.columna) : undefined

  const dibujar = (arco: Arco, realzado: boolean) => {
    const relacion = arco.peso / maximo
    const deNodo = nodo !== null && arco.i === nodo
    const haciaNodo = nodo !== null && arco.j === nodo && arco.i !== nodo
    let opacidad = 0.2 + relacion * 0.65
    if (nodo !== null) opacidad = deNodo ? 0.95 : haciaNodo ? 0.4 : 0.05
    if (senalada && !realzado) opacidad *= 0.35
    return (
      <path
        key={`${arco.i}-${arco.j}${realzado ? '-r' : ''}`}
        d={trazo(arco.i, arco.j, n)}
        fill="none"
        stroke={realzado || deNodo ? 'var(--color-hueso)' : 'var(--color-fluor-5)'}
        strokeWidth={0.5 + relacion * 3.6}
        strokeLinecap="round"
        opacity={realzado ? 1 : opacidad}
        markerEnd={arco.i === arco.j ? undefined : 'url(#punta-red)'}
        onMouseEnter={() => alSenalar({ fila: arco.i, columna: arco.j })}
        onMouseLeave={() => alSenalar(null)}
        className="transition-opacity duration-150"
      >
        <title>{`${nombres[arco.i]} → ${nombres[arco.j]}: ${decimal(arco.peso, 2)}`}</title>
      </path>
    )
  }

  return (
    <svg viewBox="-170 -170 340 340" className="h-full max-h-full w-full" role="img" aria-label="Red de parejas: el grosor de cada flecha es el peso del arco">
      <defs>
        <marker id="punta-red" viewBox="0 0 10 10" refX="7" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      <g>{visibles.map((arco) => dibujar(arco, false))}</g>
      {elegido && <g>{dibujar(elegido, true)}</g>}
      {nombres.map((nombre, i) => {
        const [x, y] = posicion(i, n)
        const activo = nodo === i || senalada?.fila === i || senalada?.columna === i
        return (
          <g
            key={nombre}
            transform={`translate(${x} ${y})`}
            onMouseEnter={() => setNodo(i)}
            onMouseLeave={() => setNodo(null)}
            className="cursor-default"
            data-nodo-red={nombre}
          >
            <circle r={RADIO_NODO} fill="var(--color-superficie-2)" stroke={activo ? 'var(--color-hueso)' : 'var(--color-linea-fuerte)'} strokeWidth={activo ? 2 : 1} />
            <text textAnchor="middle" dominantBaseline="central" className="mono text-[0.68rem] font-bold">
              {[...nombre].map((letra, k) => (
                <tspan key={k} fill={COLOR_BASE[letra] ?? COLOR_AMBIGUA}>
                  {letra}
                </tspan>
              ))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
