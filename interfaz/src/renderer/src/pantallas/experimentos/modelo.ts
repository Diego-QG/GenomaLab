// Lo que la pantalla Experimentos saca de la respuesta del comando `experimento`,
// y la geometría de cada panel del gráfico (la usan el SVG de la pantalla y el
// PNG exportado, para que la imagen sea igual a lo que se ve).
// Aquí no se inventa ningún número: todo sale de lo que envió el motor.

import { max, scaleLinear } from 'd3'
import type { MetodoSondeo, RespuestaExperimento, ResultadoExperimento } from '@compartido/contrato'
import { SIN_DATO, entero } from '@/lib/formato'
import { COLOR_DOBLE, COLOR_LINEAL } from '@/pantallas/kmers/Insercion'

// ── Datos por k ──────────────────────────────────────────────────────────────

export interface CifrasMetodo {
  total: number
  promedio: number
  carga: number
}

export interface PanelK {
  k: number
  lineal: CifrasMetodo
  doble: CifrasMetodo
  /** Factor de carga promedio (el motor manda el mismo en los dos métodos). */
  carga: number
  /** (lineal − doble) / lineal × 100, con los totales. NaN si no se puede calcular. */
  reduccion: number
  /** Virus distintos que el motor contó con este k (de `porVirus`). */
  virus: number
  /** Virus en los que el doble hashing chocó menos que el sondeo lineal. */
  menosConDoble: number
  /** Colisiones de cada virus, para dibujarlos como puntos. */
  puntos: Record<MetodoSondeo, PuntoVirus[]>
}

export interface PuntoVirus {
  id: string
  valor: number
}

export const METODOS: readonly MetodoSondeo[] = ['lineal', 'doble']

export const NOMBRE_METODO: Record<MetodoSondeo, string> = {
  lineal: 'Sondeo lineal',
  doble: 'Doble hashing',
}

export const COLOR_METODO: Record<MetodoSondeo, string> = {
  lineal: COLOR_LINEAL,
  doble: COLOR_DOBLE,
}

const SIN_CIFRAS: CifrasMetodo = { total: Number.NaN, promedio: Number.NaN, carga: Number.NaN }

function cifrasDe(fila: ResultadoExperimento | undefined): CifrasMetodo {
  if (!fila) return SIN_CIFRAS
  return { total: fila.colisionesTotal, promedio: fila.colisionesPromedio, carga: fila.factorCargaPromedio }
}

export function esFinito(n: number): boolean {
  return Number.isFinite(n)
}

/** % de reducción del doble respecto del lineal; NaN si falta un dato o el lineal es 0. */
export function reduccionDe(lineal: number, doble: number): number {
  if (!esFinito(lineal) || !esFinito(doble) || lineal === 0) return Number.NaN
  return ((lineal - doble) / lineal) * 100
}

/** Un panel por cada k que devolvió el motor, de menor a mayor. */
export function armarPaneles(datos: RespuestaExperimento): PanelK[] {
  const ks = [...new Set(datos.resultados.map((r) => r.k))].sort((a, b) => a - b)
  return ks.map((k): PanelK => {
    // Se empareja por k y método, no por la posición en la lista
    const lineal = cifrasDe(datos.resultados.find((r) => r.k === k && r.metodo === 'lineal'))
    const doble = cifrasDe(datos.resultados.find((r) => r.k === k && r.metodo === 'doble'))
    const filas = datos.porVirus.filter((v) => v.k === k)
    const puntos: Record<MetodoSondeo, PuntoVirus[]> = {
      lineal: filas.map((v) => ({ id: v.id, valor: v.lineal })).filter((p) => esFinito(p.valor)),
      doble: filas.map((v) => ({ id: v.id, valor: v.doble })).filter((p) => esFinito(p.valor)),
    }
    return {
      k,
      lineal,
      doble,
      carga: esFinito(doble.carga) ? doble.carga : lineal.carga,
      reduccion: reduccionDe(lineal.total, doble.total),
      virus: new Set(filas.map((v) => v.id)).size,
      menosConDoble: filas.filter((v) => esFinito(v.lineal) && esFinito(v.doble) && v.doble < v.lineal).length,
      puntos,
    }
  })
}

/** Cuántas veces más choca el sondeo lineal con el k menor que con el mayor (NaN si no se puede). */
export function vecesEntreKs(paneles: readonly PanelK[]): number {
  if (paneles.length < 2) return Number.NaN
  const menor = paneles[0].lineal.promedio
  const mayor = paneles[paneles.length - 1].lineal.promedio
  if (!esFinito(menor) || !esFinito(mayor) || mayor <= 0) return Number.NaN
  return menor / mayor
}

// ── Formato ──────────────────────────────────────────────────────────────────

/** 1234.5 → "1 234.50" (miles separados como en `entero`). */
export function conDecimales(n: number, decimales = 2): string {
  if (!esFinito(n)) return SIN_DATO
  const [parteEntera, parteDecimal] = Math.abs(n).toFixed(decimales).split('.')
  const signo = n < 0 ? '−' : ''
  return `${signo}${entero(Number(parteEntera))}${parteDecimal ? `.${parteDecimal}` : ''}`
}

/** 12.34 → "−12.3 %" (menos choques); −3 → "+3.0 %" (más choques). */
export function textoReduccion(reduccion: number, decimales = 1): string {
  if (!esFinito(reduccion)) return SIN_DATO
  const signo = reduccion > 0 ? '−' : reduccion < 0 ? '+' : ''
  return `${signo}${Math.abs(reduccion).toFixed(decimales)} %`
}

/** Casillas de cada tabla de k-mers del motor: 4^k, todos los k-mers posibles con A, C, G, T (TablaKmers.cpp). */
export function casillasDe(k: number): number {
  return 4 ** k
}

// ── Geometría de un panel ────────────────────────────────────────────────────

export interface Rect {
  x: number
  y: number
  ancho: number
  alto: number
}

export interface ColumnaGeometria {
  metodo: MetodoSondeo
  color: string
  nombre: string
  /** Centro de la columna (para el nombre del método debajo). */
  centro: number
  barra: Rect | null
  /** Valor escrito encima de la barra. */
  etiqueta: { x: number; y: number; texto: string } | null
  puntos: { x: number; y: number; id: string; valor: number }[]
}

export interface GeometriaPanel {
  ancho: number
  alto: number
  izquierda: number
  derecha: number
  arriba: number
  /** y de la línea base (cero). */
  base: number
  /** y del nombre de cada método. */
  yNombre: number
  marcas: { y: number; texto: string }[]
  columnas: ColumnaGeometria[]
  /** Contorno punteado sobre la barra del doble: hasta dónde llegaba el lineal. */
  fantasma: Rect | null
  /** % de reducción dentro del contorno punteado, si cabe. */
  reduccion: { x: number; y: number; texto: string } | null
  radioPunto: number
}

const MARGEN = { izquierda: 50, derecha: 6, arriba: 22, abajo: 26 }

/** Dispersión horizontal fija de cada punto (siempre la misma para el mismo índice). */
function dispersion(i: number): number {
  const s = Math.sin((i + 1) * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Coloca las dos barras (promedio de colisiones por virus) y los puntos de cada
 * virus. La escala es propia de este panel: de 0 al mayor valor entre barras y puntos.
 */
export function geometriaDePanel(panel: PanelK, ancho: number, alto: number): GeometriaPanel {
  const izquierda = MARGEN.izquierda
  const derecha = ancho - MARGEN.derecha
  const arriba = MARGEN.arriba
  const base = Math.max(arriba + 20, alto - MARGEN.abajo)

  const valores = [panel.lineal.promedio, panel.doble.promedio, ...panel.puntos.lineal.map((p) => p.valor), ...panel.puntos.doble.map((p) => p.valor)].filter(esFinito)
  const tope = max(valores) ?? 0
  const y = scaleLinear()
    .domain([0, tope > 0 ? tope : 1])
    .nice(4)
    .range([base, arriba])
  const marcas = y.ticks(4).map((v) => ({ y: y(v), texto: entero(v) }))

  const anchoColumna = Math.max(0, (derecha - izquierda) / METODOS.length)
  const anchoBarra = Math.min(78, anchoColumna * 0.42)
  const separacion = Math.min(14, anchoColumna * 0.07)
  const anchoCarril = Math.min(58, anchoColumna * 0.3)
  const radioPunto = anchoCarril < 30 ? 1.6 : 2.1

  const columnas = METODOS.map((metodo, i): ColumnaGeometria => {
    const centro = izquierda + anchoColumna * (i + 0.5)
    const inicio = centro - (anchoBarra + separacion + anchoCarril) / 2
    const valor = panel[metodo].promedio
    const barra = esFinito(valor) ? { x: inicio, y: y(valor), ancho: anchoBarra, alto: base - y(valor) } : null
    const carril = inicio + anchoBarra + separacion
    const puntos = panel.puntos[metodo].map((p, j) => ({
      x: carril + radioPunto + dispersion(j) * Math.max(0, anchoCarril - 2 * radioPunto),
      y: y(p.valor),
      id: p.id,
      valor: p.valor,
    }))
    return {
      metodo,
      color: COLOR_METODO[metodo],
      nombre: NOMBRE_METODO[metodo],
      centro,
      barra,
      etiqueta: barra ? { x: barra.x + barra.ancho / 2, y: barra.y - 7, texto: entero(valor) } : null,
      puntos,
    }
  })

  // Lo que el doble se ahorró respecto del lineal, dibujado sobre su barra
  let fantasma: Rect | null = null
  let reduccion: GeometriaPanel['reduccion'] = null
  const barraDoble = columnas[1]?.barra
  if (barraDoble && esFinito(panel.lineal.promedio) && panel.lineal.promedio > panel.doble.promedio) {
    const yLineal = y(panel.lineal.promedio)
    fantasma = { x: barraDoble.x, y: yLineal, ancho: barraDoble.ancho, alto: barraDoble.y - yLineal }
    // Cabe el texto si queda sitio entre el borde de arriba y la etiqueta del doble (≈ 18 px)
    if (fantasma.alto >= 46 && esFinito(panel.reduccion)) {
      reduccion = { x: barraDoble.x + barraDoble.ancho / 2, y: yLineal + (fantasma.alto - 18) / 2 + 4, texto: textoReduccion(panel.reduccion) }
    }
  }

  return { ancho, alto, izquierda, derecha, arriba, base, yNombre: base + 18, marcas, columnas, fantasma, reduccion, radioPunto }
}
