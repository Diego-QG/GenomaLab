// Matemática de la Galaxia: de los 64 conteos de 3-mers de cada virus a un punto del
// plano. Todo a mano, sin librerías de álgebra:
//
//  1. Similitud coseno entre cada par de virus.
//  2. Distancia: d² = 2·(1 − cos). Es la distancia euclidiana entre los dos vectores
//     normalizados a largo 1, así que es una distancia "de verdad" y la matriz B del
//     paso 3 sale semidefinida positiva (sus autovalores son ≥ 0 salvo redondeo).
//  3. MDS clásico: B = −½·J·D²·J (doble centrado, J = I − 1/N). Sin centrar, lo que
//     todos los virus tienen en común (los cosenos de k = 3 rondan 0,98) taparía las
//     diferencias y todo quedaría apilado en un punto.
//  4. Los dos autovectores de B con mayor autovalor, por iteración de potencias: el
//     segundo se mantiene ortogonal al primero (Gram–Schmidt en cada vuelta).
//  5. Coordenadas = autovector · √autovalor.
//
// Es determinista: el vector inicial sale de una secuencia fija y el signo de cada eje
// se elige siempre igual, así que los mismos datos dan siempre el mismo mapa.

export interface PuntoProyectado {
  /** Posición del vector en la lista de entrada. */
  indice: number
  x: number
  y: number
}

export interface Proyeccion {
  /** Los vectores que sí se pudieron ubicar, en el orden de entrada. */
  puntos: PuntoProyectado[]
  /** Posiciones de entrada de los vectores que no se pueden ubicar: sin conteos (norma 0) o con valores no numéricos. */
  sinUbicar: number[]
  /** λ1 y λ2, ya recortados a ≥ 0 (variación que recoge cada eje). */
  autovalores: [number, number]
  /** Traza de B: la variación total (la suma de todos sus autovalores). */
  traza: number
  /** (λ1 + λ2) / traza: qué fracción de la variación conservan los dos ejes; null si no hay variación. */
  conservada: number | null
  /** Cosenos entre los puntos ubicados (n × n, fila por fila, en el orden de `puntos`). */
  cosenos: Float64Array
  /** Vueltas de la iteración de potencias que usó cada eje (para saber si llegó al tope). */
  vueltas: [number, number]
}

/** Tope de vueltas de la iteración de potencias para cada autovector. */
export const MAXIMO_VUELTAS = 3000
const TOLERANCIA = 1e-10

/** true si el vector tiene al menos un conteo distinto de 0 y ningún valor no numérico. */
export function esVectorValido(vector: readonly number[] | null | undefined, largo: number): vector is readonly number[] {
  if (!vector || vector.length !== largo || largo === 0) return false
  let normaCuadrada = 0
  for (const valor of vector) {
    if (!Number.isFinite(valor)) return false
    normaCuadrada += valor * valor
  }
  return normaCuadrada > 0 && Number.isFinite(normaCuadrada)
}

/**
 * Coseno entre cada par de vectores (n × n, fila por fila). La diagonal es 1. Si un
 * vector tiene norma 0 el coseno no está definido: con los demás queda en 0.
 */
export function matrizDeCosenos(vectores: readonly (readonly number[])[]): Float64Array {
  const n = vectores.length
  const normas = vectores.map((v) => Math.sqrt(v.reduce((suma, x) => suma + x * x, 0)))
  const cosenos = new Float64Array(n * n)
  for (let i = 0; i < n; i++) {
    cosenos[i * n + i] = 1
    for (let j = i + 1; j < n; j++) {
      const a = vectores[i]
      const b = vectores[j]
      let producto = 0
      for (let t = 0; t < a.length; t++) producto += a[t] * (b[t] ?? 0)
      const divisor = normas[i] * normas[j]
      let c = divisor > 0 ? producto / divisor : 0
      c = Number.isFinite(c) ? Math.max(-1, Math.min(1, c)) : 0
      cosenos[i * n + j] = c
      cosenos[j * n + i] = c
    }
  }
  return cosenos
}

/** B = −½·J·D²·J con d² = 2·(1 − cos): resta a cada d² la media de su fila y de su columna y suma la media total. */
export function dobleCentrado(cosenos: Float64Array, n: number): Float64Array {
  const d2 = new Float64Array(n * n)
  for (let k = 0; k < n * n; k++) d2[k] = Math.max(0, 2 * (1 - cosenos[k]))
  for (let i = 0; i < n; i++) d2[i * n + i] = 0

  const mediaFila = new Float64Array(n)
  let mediaTotal = 0
  for (let i = 0; i < n; i++) {
    let suma = 0
    for (let j = 0; j < n; j++) suma += d2[i * n + j]
    mediaFila[i] = suma / n
    mediaTotal += suma
  }
  mediaTotal /= n * n

  // D² es simétrica: la media de la columna j es la de la fila j
  const b = new Float64Array(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) b[i * n + j] = -0.5 * (d2[i * n + j] - mediaFila[i] - mediaFila[j] + mediaTotal)
  }
  return b
}

/** Secuencia pseudoaleatoria fija (generador congruencial lineal): mismo vector inicial en cada corrida. */
function vectorInicial(n: number, semilla: number): Float64Array {
  const v = new Float64Array(n)
  let s = semilla >>> 0
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    v[i] = s / 4294967296 - 0.5
  }
  return v
}

function multiplicar(m: Float64Array, v: Float64Array, n: number, destino: Float64Array): void {
  for (let i = 0; i < n; i++) {
    let suma = 0
    const fila = i * n
    for (let j = 0; j < n; j++) suma += m[fila + j] * v[j]
    destino[i] = suma
  }
}

function punto(a: Float64Array, b: Float64Array): number {
  let suma = 0
  for (let i = 0; i < a.length; i++) suma += a[i] * b[i]
  return suma
}

/** Le quita a `v` sus componentes en la dirección de cada vector de `base` (unitarios). */
function ortogonalizar(v: Float64Array, base: readonly Float64Array[]): void {
  for (const u of base) {
    const c = punto(v, u)
    for (let i = 0; i < v.length; i++) v[i] -= c * u[i]
  }
}

/** Divide por la norma; devuelve false (y deja ceros) si la norma es despreciable. */
function normalizar(v: Float64Array, minimo: number): boolean {
  const norma = Math.sqrt(punto(v, v))
  if (!(norma > minimo)) {
    v.fill(0)
    return false
  }
  for (let i = 0; i < v.length; i++) v[i] /= norma
  return true
}

interface Autopar {
  vector: Float64Array
  valor: number
  vueltas: number
}

/**
 * Iteración de potencias: v ← B·v / |B·v| hasta que v deja de cambiar. Converge al
 * autovector del mayor autovalor (B es semidefinida positiva). Con `previos`, cada
 * vuelta le quita las direcciones ya halladas, así que converge al siguiente.
 */
function autoparPrincipal(b: Float64Array, n: number, previos: readonly Float64Array[], semilla: number, escala: number): Autopar {
  const minimo = 1e-12 * Math.max(escala, Number.MIN_VALUE)
  const v = vectorInicial(n, semilla)
  ortogonalizar(v, previos)
  if (!normalizar(v, 0)) return { vector: v, valor: 0, vueltas: 0 }

  const w = new Float64Array(n)
  let vueltas = 0
  while (vueltas < MAXIMO_VUELTAS) {
    vueltas++
    multiplicar(b, v, n, w)
    ortogonalizar(w, previos)
    if (!normalizar(w, minimo)) return { vector: w, valor: 0, vueltas } // no queda variación en otra dirección
    let cambio = 0
    for (let i = 0; i < n; i++) {
      const d = w[i] - v[i]
      cambio += d * d
    }
    v.set(w)
    if (Math.sqrt(cambio) < TOLERANCIA) break
  }

  multiplicar(b, v, n, w)
  const valor = punto(v, w) // cociente de Rayleigh (v es unitario)
  return { vector: v, valor: Number.isFinite(valor) ? valor : 0, vueltas }
}

/** Signo fijo: la componente de mayor valor absoluto queda positiva (en un empate, la primera). */
function fijarSigno(v: Float64Array): void {
  let mayor = 0
  for (let i = 1; i < v.length; i++) if (Math.abs(v[i]) > Math.abs(v[mayor])) mayor = i
  if (v[mayor] < 0) for (let i = 0; i < v.length; i++) v[i] = -v[i]
}

/**
 * Proyecta los vectores de conteos al plano con MDS clásico sobre d² = 2·(1 − cos).
 * Los vectores sin conteos (o con valores no numéricos) quedan en `sinUbicar`.
 */
export function proyectar(vectores: readonly (readonly number[] | null | undefined)[]): Proyeccion {
  const largo = vectores.find((v) => v && v.length > 0)?.length ?? 0
  const indices: number[] = []
  const sinUbicar: number[] = []
  const validos: (readonly number[])[] = []
  vectores.forEach((v, i) => {
    if (esVectorValido(v, largo)) {
      indices.push(i)
      validos.push(v)
    } else sinUbicar.push(i)
  })

  const n = validos.length
  const cosenos = matrizDeCosenos(validos)
  if (n === 0) return { puntos: [], sinUbicar, autovalores: [0, 0], traza: 0, conservada: null, cosenos, vueltas: [0, 0] }

  const b = dobleCentrado(cosenos, n)
  let traza = 0
  for (let i = 0; i < n; i++) traza += b[i * n + i]
  traza = Math.max(0, traza)

  const primero = autoparPrincipal(b, n, [], 0x9e3779b9, traza)
  fijarSigno(primero.vector)
  const segundo = autoparPrincipal(b, n, primero.valor > 0 ? [primero.vector] : [], 0x85ebca6b, traza)
  fijarSigno(segundo.vector)

  // Autovalores negativos (solo por redondeo) se recortan a 0: ese eje no aporta
  const l1 = Math.max(0, primero.valor)
  const l2 = Math.max(0, segundo.valor)
  const r1 = Math.sqrt(l1)
  const r2 = Math.sqrt(l2)
  const puntos = indices.map((indice, k) => {
    const x = primero.vector[k] * r1
    const y = segundo.vector[k] * r2
    return { indice, x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }
  })
  const conservada = traza > 0 ? Math.max(0, Math.min(1, (l1 + l2) / traza)) : null

  return { puntos, sinUbicar, autovalores: [l1, l2], traza, conservada, cosenos, vueltas: [primero.vueltas, segundo.vueltas] }
}
