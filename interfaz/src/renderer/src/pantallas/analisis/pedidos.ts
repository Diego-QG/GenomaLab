// Pedidos al motor que usan las vistas de "Análisis". Cada uno se queda solo con lo
// que la vista necesita de la respuesta (ver motor/lote.ts).

import { pedir } from '@/motor/cliente'
import type { ItemLote } from '@/motor/lote'

// ── kmers <id> <k> <n> ───────────────────────────────────────────────────────

export interface ConteoKmers {
  /** Colisiones al contar toda la secuencia con cada método (las cuenta el motor). */
  colisiones: { lineal: number; doble: number }
  /** Conteo de cada uno de los 64 3-mers, en orden AAA, AAC, …, TTT (solo con k = 3). */
  vector: number[] | null
}

const INDICE_BASE: Readonly<Record<string, number>> = { A: 0, C: 1, G: 2, T: 3 }

/** Posición de un k-mer en el orden AAA…TTT (−1 si tiene una letra que no es ACGT). */
function indiceDeKmer(kmer: string, k: number): number {
  if (kmer.length !== k) return -1
  let indice = 0
  for (const letra of kmer) {
    const base = INDICE_BASE[letra]
    if (base === undefined) return -1
    indice = indice * 4 + base
  }
  return indice
}

/**
 * `kmers <id> <k> 1`: el top no hace falta (n = 1); las colisiones y, con k = 3,
 * los conteos de todas las casillas ocupadas de la tabla.
 */
export function itemKmers(id: string, k: 3 | 6): ItemLote<ConteoKmers> {
  return {
    clave: `kmers|${id}|${k}`,
    ejecutar: () =>
      pedir('kmers', [id, String(k), '1'], { guardar: false }).then((r) => {
        let vector: number[] | null = null
        if (k === 3) {
          vector = new Array<number>(64).fill(0)
          for (const casilla of r.casillas) {
            const i = indiceDeKmer(casilla.kmer, 3)
            if (i >= 0) vector[i] += casilla.conteo
          }
        }
        return { colisiones: { lineal: r.colisiones.lineal, doble: r.colisiones.doble }, vector }
      }),
  }
}

// ── comparar <id1> <id2> ─────────────────────────────────────────────────────

export interface Similitudes {
  k3: number
  k6: number
  grafo: number
}

/** `comparar <a> <b>`: las tres similitudes (son simétricas, así que a-b y b-a comparten caché). */
export function itemComparar(a: string, b: string): ItemLote<Similitudes> {
  const par = a < b ? `${a}|${b}` : `${b}|${a}`
  return {
    clave: `comparar|${par}`,
    ejecutar: () => pedir('comparar', [a, b], { guardar: false }).then((r) => ({ k3: r.simKmers3, k6: r.simKmers6, grafo: r.simGrafo })),
  }
}
