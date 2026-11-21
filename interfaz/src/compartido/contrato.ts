// Contrato JSON con el motor (BRIEF-INTERFAZ.md, sección 5).
// Estos tipos describen lo que imprime `ProyectoGenomico.exe --json <fasta> <comando> [args...]`.
// La interfaz no calcula nada de esto: solo lo recibe, lo anima y lo dibuja.
//
// Cada respuesta se revisa contra estos tipos en validacion.ts antes de llegar a
// las pantallas. Si el motor omite un campo que se puede suplir, un número queda
// como NaN (se muestra «—») y una lista queda vacía; los campos marcados aquí con
// `| null` son los que la interfaz sabe mostrar ausentes.

export interface RespuestaError {
  ok: false
  error: string
}

// 5.1 resumen
export interface Redimension {
  de: number
  a: number
  /** Número (desde 1) de la inserción que provocó el redimensionamiento. */
  enInsercion: number
}

export interface CasillaOcupada {
  pos: number
  id: string
}

export interface VirusResumen {
  id: string
  grupo: string
  longitud: number
  gc: number
  ambiguas: number
}

export interface TablaResumen {
  tamano: number
  cantidad: number
  colisiones: number
  factorCarga: number
  redimensiones: Redimension[]
  ocupadas: CasillaOcupada[]
}

export interface RespuestaResumen {
  ok: true
  /** null solo si el motor no lo envió (ver validacion.ts): se muestra el nombre del archivo cargado. */
  archivo: string | null
  total: number
  /** null solo si el motor no lo envió o llegó incompleto (ver validacion.ts). */
  tabla: TablaResumen | null
  virus: VirusResumen[]
}

// 5.2 virus <id>
export interface BaseAmbigua {
  pos: number
  letra: string
}

export interface RespuestaVirus {
  ok: true
  id: string
  grupo: string
  longitud: number
  gc: number
  ambiguas: BaseAmbigua[]
  secuencia: string
}

// 5.3 buscar <id>
export interface PasoHash {
  letra: string
  /** unsigned long long como texto (no cabe en un número de JavaScript). */
  valor: string
}

export interface PasoBusqueda {
  pos: number
  ocupada: boolean
  idEnCasilla?: string | null
  igual?: boolean
}

export interface RespuestaBuscar {
  ok: true
  id: string
  hashPasos: PasoHash[]
  hash: string
  tamano: number
  inicio: number
  pasos: PasoBusqueda[]
  encontrado: boolean
  posFinal: number
}

// 5.4 kmers <id> <k> <n>
export interface ParKmer {
  kmer: string
  conteo: number
}

export interface CasillaKmer {
  pos: number
  kmer: string
  conteo: number
}

export interface RespuestaKmers {
  ok: true
  id: string
  k: number
  tamanoTabla: number
  ventanas: number
  descartadas: number
  distintos: number
  colisiones: { lineal: number; doble: number }
  casillas: CasillaKmer[]
  top: ParKmer[]
}

// 5.5 trazakmers <id> <k> <metodo> <limite>
export type MetodoSondeo = 'lineal' | 'doble'
export type ResultadoSalto = 'colision' | 'nuevo' | 'sumado' | 'descartado'

export interface SaltoKmer {
  pos: number
  kmerEnCasilla: string | null
  resultado: ResultadoSalto
}

export interface InsercionKmer {
  ventana: number
  kmer: string
  // No vienen en una inserción descartada (k-mer con base ambigua)
  hash?: string
  inicio?: number
  paso?: number
  saltos: SaltoKmer[]
  conteoFinal: number
}

export interface RespuestaTrazaKmers {
  ok: true
  id: string
  k: number
  metodo: MetodoSondeo
  tamanoTabla: number
  inserciones: InsercionKmer[]
}

// 5.6 heap <id> <k> <n>
export interface OperacionHeap {
  op: 'insertar' | 'extraer'
  par: ParKmer
  /** Pares de índices del arreglo que se intercambian, en orden. */
  intercambios: [number, number][]
}

export interface RespuestaHeap {
  ok: true
  id: string
  k: number
  n: number
  operaciones: OperacionHeap[]
  top: ParKmer[]
}

// 5.7 grafo <id> [limiteArcos]
export interface ArcoEjemplo {
  /** Índice de la pareja de origen dentro de la secuencia cortada. */
  a: number
  /** Índice de la pareja de destino. */
  b: number
  desde: string
  hasta: string
  distancia: number
  peso: number
}

export interface RespuestaGrafo {
  ok: true
  id: string
  nombres: string[]
  parejas: number
  parejasInvalidas: number
  matriz: number[][]
  arcosEjemplo: ArcoEjemplo[]
}

// 5.8 comparar <id1> <id2>
export interface RespuestaComparar {
  ok: true
  id1: string
  id2: string
  simKmers3: number
  simKmers6: number
  simGrafo: number
  diferenciaGrafo: number[][]
}

// 5.9 parecidos <id> <k>
export interface Parecido {
  id: string
  grupo: string
  simKmers: number
  simGrafo: number
}

export interface RespuestaParecidos {
  ok: true
  id: string
  k: number
  ranking: Parecido[]
}

// 5.10 similitudes <k>
export interface RespuestaSimilitudes {
  ok: true
  k: number
  ids: string[]
  grupos: string[]
  matriz: number[][]
}

// 5.11 experimento
export interface ResultadoExperimento {
  k: number
  metodo: MetodoSondeo
  colisionesTotal: number
  colisionesPromedio: number
  factorCargaPromedio: number
}

export interface RespuestaExperimento {
  ok: true
  resultados: ResultadoExperimento[]
  porVirus: { id: string; k: number; lineal: number; doble: number }[]
}

/** Cada comando con la forma de su respuesta correcta. */
export interface Comandos {
  resumen: RespuestaResumen
  virus: RespuestaVirus
  buscar: RespuestaBuscar
  kmers: RespuestaKmers
  trazakmers: RespuestaTrazaKmers
  heap: RespuestaHeap
  grafo: RespuestaGrafo
  comparar: RespuestaComparar
  parecidos: RespuestaParecidos
  similitudes: RespuestaSimilitudes
  experimento: RespuestaExperimento
}

export type NombreComando = keyof Comandos

export const NOMBRES_COMANDOS: readonly NombreComando[] = [
  'resumen',
  'virus',
  'buscar',
  'kmers',
  'trazakmers',
  'heap',
  'grafo',
  'comparar',
  'parecidos',
  'similitudes',
  'experimento',
]

export type Respuesta<C extends NombreComando = NombreComando> = Comandos[C] | RespuestaError
