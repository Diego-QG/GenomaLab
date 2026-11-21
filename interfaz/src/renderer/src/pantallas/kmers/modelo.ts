// De la traza del motor (`trazakmers`) a los cuadros de la animación.
// Aquí no se calcula ningún hash ni conteo: solo se "rebobina" la traza hasta un
// punto para saber qué había en cada casilla en ese momento.

import type { InsercionKmer, ResultadoSalto, SaltoKmer } from '@compartido/contrato'

/** Un cuadro = una inserción (ventana) y cuántos saltos de ella ya se mostraron. */
export interface Cuadro {
  ins: number
  sub: number
}

export function esDescartada(insercion: InsercionKmer): boolean {
  return insercion.saltos.length === 0 || insercion.saltos.some((s) => s.resultado === 'descartado')
}

/** Saltos reales de una inserción (una descartada no toca la tabla). */
function saltosDe(insercion: InsercionKmer): SaltoKmer[] {
  return esDescartada(insercion) ? [] : insercion.saltos
}

function contarColisiones(saltos: SaltoKmer[]): number {
  let n = 0
  for (const s of saltos) if (s.resultado === 'colision') n++
  return n
}

/** Colisiones de toda la traza (para la escala de las barras que compiten). */
export function colisionesTotales(inserciones: InsercionKmer[]): number {
  let n = 0
  for (const ins of inserciones) n += contarColisiones(ins.saltos)
  return n
}

/**
 * Las dos tablas avanzan juntas, ventana por ventana: cada inserción dura tantos
 * cuadros como saltos necesite la tabla a la que más le cueste.
 */
export function construirCuadros(lineal: InsercionKmer[], doble: InsercionKmer[]): Cuadro[] {
  const cuadros: Cuadro[] = []
  const n = Math.min(lineal.length, doble.length)
  for (let ins = 0; ins < n; ins++) {
    const largo = Math.max(1, saltosDe(lineal[ins]).length, saltosDe(doble[ins]).length)
    for (let sub = 0; sub < largo; sub++) cuadros.push({ ins, sub })
  }
  return cuadros
}

/** Índice del primer cuadro de cada inserción (para saltar a una ventana). */
export function inicioDeCadaInsercion(cuadros: Cuadro[]): number[] {
  const inicios: number[] = []
  cuadros.forEach((c, i) => {
    if (c.sub === 0) inicios[c.ins] = i
  })
  return inicios
}

export interface EstadoTabla {
  /** k-mer guardado en cada casilla (null = libre). */
  kmers: (string | null)[]
  conteos: Int32Array
  ocupadas: number
  /** Colisiones acumuladas hasta este cuadro. */
  colisiones: number
  /** Casillas que la inserción actual lleva visitadas, en orden. */
  camino: SaltoKmer[]
  /** Resultado de la inserción actual, si ya terminó en este cuadro. */
  resultado: ResultadoSalto | null
  /** Casilla donde terminó la inserción actual (o −1). */
  destino: number
}

/** Estado de una tabla en un cuadro: la traza aplicada hasta ahí. */
export function estadoEn(inserciones: InsercionKmer[], tamano: number, cuadro: Cuadro): EstadoTabla {
  const kmers: (string | null)[] = new Array<string | null>(tamano).fill(null)
  const conteos = new Int32Array(tamano)
  let ocupadas = 0
  let colisiones = 0

  const aplicar = (insercion: InsercionKmer): void => {
    const saltos = saltosDe(insercion)
    const ultimo = saltos[saltos.length - 1]
    if (!ultimo) return
    colisiones += contarColisiones(saltos)
    if (ultimo.resultado === 'nuevo') {
      kmers[ultimo.pos] = insercion.kmer
      ocupadas++
    }
    conteos[ultimo.pos] = insercion.conteoFinal
  }

  for (let i = 0; i < cuadro.ins && i < inserciones.length; i++) aplicar(inserciones[i])

  const actual = inserciones[cuadro.ins]
  if (!actual) return { kmers, conteos, ocupadas, colisiones, camino: [], resultado: null, destino: -1 }

  if (esDescartada(actual)) {
    return { kmers, conteos, ocupadas, colisiones, camino: [], resultado: 'descartado', destino: -1 }
  }

  const saltos = actual.saltos
  const vistos = Math.min(cuadro.sub + 1, saltos.length)
  const camino = saltos.slice(0, vistos)
  const termino = vistos === saltos.length
  if (termino) {
    aplicar(actual)
  } else {
    colisiones += contarColisiones(camino)
  }
  const ultimo = saltos[saltos.length - 1]
  return {
    kmers,
    conteos,
    ocupadas,
    colisiones,
    camino,
    resultado: termino ? ultimo.resultado : null,
    destino: termino ? ultimo.pos : -1,
  }
}
