// De las operaciones del motor (`heap`) a los cuadros de la animación.
// La interfaz no decide ningún intercambio: aplica, en orden, los que el motor anotó.

import type { OperacionHeap, ParKmer } from '@compartido/contrato'

export type Cuadro =
  | { tipo: 'inicio' }
  /** Un elemento nuevo entra al final del arreglo. */
  | { tipo: 'agregar'; op: number }
  /** Dos posiciones del arreglo se intercambian. */
  | { tipo: 'intercambio'; op: number; i: number; j: number; motivo: 'subir' | 'raiz' | 'bajar' }
  /** El máximo (ya llevado al final) sale del heap. */
  | { tipo: 'quitar'; op: number }

export function construirCuadros(operaciones: OperacionHeap[]): Cuadro[] {
  const cuadros: Cuadro[] = [{ tipo: 'inicio' }]
  operaciones.forEach((operacion, op) => {
    if (operacion.op === 'insertar') {
      cuadros.push({ tipo: 'agregar', op })
      for (const [i, j] of operacion.intercambios) {
        if (i !== j) cuadros.push({ tipo: 'intercambio', op, i, j, motivo: 'subir' })
      }
    } else {
      // El primer intercambio es la raíz con el último; los demás son de bajar().
      const [primero, ...resto] = operacion.intercambios
      if (primero && primero[0] !== primero[1]) {
        cuadros.push({ tipo: 'intercambio', op, i: primero[0], j: primero[1], motivo: 'raiz' })
      }
      cuadros.push({ tipo: 'quitar', op })
      for (const [i, j] of resto) {
        if (i !== j) cuadros.push({ tipo: 'intercambio', op, i, j, motivo: 'bajar' })
      }
    }
  })
  return cuadros
}

/** Índice del primer cuadro de la primera extracción (o −1 si no hay). */
export function primerCuadroDeExtraccion(cuadros: Cuadro[], operaciones: OperacionHeap[]): number {
  return cuadros.findIndex((c) => c.tipo !== 'inicio' && operaciones[c.op]?.op === 'extraer')
}

export interface EstadoHeap {
  arreglo: ParKmer[]
  extraidos: ParKmer[]
  /** Los dos elementos del último intercambio, tal como estaban antes de cambiar. */
  antes: { enI: ParKmer; enJ: ParKmer } | null
}

/** El heap tal como está después de aplicar los cuadros 0 … hasta. */
export function estadoEn(operaciones: OperacionHeap[], cuadros: Cuadro[], hasta: number): EstadoHeap {
  const arreglo: ParKmer[] = []
  const extraidos: ParKmer[] = []
  let antes: EstadoHeap['antes'] = null
  const fin = Math.min(hasta, cuadros.length - 1)
  for (let c = 0; c <= fin; c++) {
    const cuadro = cuadros[c]
    antes = null
    if (cuadro.tipo === 'agregar') {
      arreglo.push(operaciones[cuadro.op].par)
    } else if (cuadro.tipo === 'intercambio') {
      const enI = arreglo[cuadro.i]
      const enJ = arreglo[cuadro.j]
      if (enI !== undefined && enJ !== undefined) {
        antes = { enI, enJ }
        arreglo[cuadro.i] = enJ
        arreglo[cuadro.j] = enI
      }
    } else if (cuadro.tipo === 'quitar') {
      arreglo.pop()
      extraidos.push(operaciones[cuadro.op].par)
    }
  }
  return { arreglo, extraidos, antes }
}

export function nivelDe(indice: number): number {
  return Math.floor(Math.log2(indice + 1))
}
