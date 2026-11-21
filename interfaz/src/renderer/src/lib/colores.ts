// Colores de los datos. Los mismos en toda la app.

import { interpolateLab, scaleLinear } from 'd3'

// ── Bases ────────────────────────────────────────────────────────────────────
// Paleta de cromatograma: A verde, C azul, G amarillo, T rojo. Los tonos exactos
// se eligieron para que todas las parejas se distingan también con daltonismo.

export const COLOR_BASE: Readonly<Record<string, string>> = {
  A: '#31e4ac',
  C: '#4a8fe8',
  G: '#e9c400',
  T: '#e5433d',
}

/** Bases ambiguas (R, Y, N, W, K, M…): gris, y siempre con trama o contorno además del color. */
export const COLOR_AMBIGUA = '#8d93ab'

/** Tinta para escribir la letra encima de una casilla de color. */
export const TINTA_SOBRE_BASE = '#0b0c14'

export const BASES = ['A', 'C', 'G', 'T'] as const

export function esBaseValida(letra: string): boolean {
  return letra === 'A' || letra === 'C' || letra === 'G' || letra === 'T'
}

export function colorDeBase(letra: string): string {
  return COLOR_BASE[letra] ?? COLOR_AMBIGUA
}

/** Qué bases puede ser cada código ambiguo (nomenclatura IUPAC). */
export const SIGNIFICADO_IUPAC: Readonly<Record<string, string>> = {
  R: 'A o G',
  Y: 'C o T',
  S: 'C o G',
  W: 'A o T',
  K: 'G o T',
  M: 'A o C',
  B: 'C, G o T',
  D: 'A, G o T',
  H: 'A, C o T',
  V: 'A, C o G',
  N: 'cualquier base',
}

// ── Grupos de virus ──────────────────────────────────────────────────────────

export type Huesped = 'humano' | 'mono' | 'desconocido'

export interface InfoGrupo {
  color: string
  huesped: Huesped
  descripcion: string
}

const VIOLETA = '#9085e9'
const NARANJA = '#dd752c'
const CIAN = '#2bb0cd'
const ROSA = '#d95f9c'
const LIMA = '#83b33a'
const GRIS = '#9aa0b8'

const GRUPOS_CONOCIDOS: Readonly<Record<string, InfoGrupo>> = {
  A: { color: VIOLETA, huesped: 'humano', descripcion: 'VIH-2, grupo A' },
  B: { color: NARANJA, huesped: 'humano', descripcion: 'VIH-2, grupo B' },
  H2_01_AB: { color: ROSA, huesped: 'humano', descripcion: 'VIH-2, recombinante de A y B (CRF01_AB)' },
  AB: { color: ROSA, huesped: 'humano', descripcion: 'VIH-2, recombinante de A y B' },
  F: { color: GRIS, huesped: 'humano', descripcion: 'VIH-2, grupo F' },
  G: { color: GRIS, huesped: 'humano', descripcion: 'VIH-2, grupo G' },
  U: { color: GRIS, huesped: 'humano', descripcion: 'VIH-2, sin clasificar' },
  SMM: { color: CIAN, huesped: 'mono', descripcion: 'VIS de mangabey gris' },
  MAC: { color: LIMA, huesped: 'mono', descripcion: 'VIS de macaco' },
  MNE: { color: LIMA, huesped: 'mono', descripcion: 'VIS de macaco cola de cerdo' },
  STM: { color: LIMA, huesped: 'mono', descripcion: 'VIS de macaco rabón' },
}

const COLORES_DE_RESERVA = [VIOLETA, NARANJA, CIAN, ROSA, LIMA]

/** Grupos de otros archivos FASTA: color estable según el nombre (no según el orden). */
function colorDeReserva(grupo: string): string {
  let suma = 0
  for (let i = 0; i < grupo.length; i++) suma = (suma * 33 + grupo.charCodeAt(i)) >>> 0
  return COLORES_DE_RESERVA[suma % COLORES_DE_RESERVA.length]
}

export function infoDeGrupo(grupo: string): InfoGrupo {
  return GRUPOS_CONOCIDOS[grupo] ?? { color: colorDeReserva(grupo), huesped: 'desconocido', descripcion: `Grupo ${grupo}` }
}

export function colorDeGrupo(grupo: string): string {
  return infoDeGrupo(grupo).color
}

// ── Escalas ──────────────────────────────────────────────────────────────────

/** Rampa de un solo tono ("fluorescencia"): poco = casi fondo, mucho = casi blanco. */
export const RAMPA_FLUOR = ['#161829', '#1d1b3a', '#2f2869', '#4b3aa8', '#7a63e8', '#b3a4ff', '#ece8ff'] as const

/** Escala de magnitud 0 … max → color de la rampa de fluorescencia. */
export function escalaFluor(max: number): (valor: number) => string {
  const tope = max > 0 ? max : 1
  const n = RAMPA_FLUOR.length - 1
  const escala = scaleLinear<string>()
    .domain(RAMPA_FLUOR.map((_, i) => (i / n) * tope))
    .range([...RAMPA_FLUOR])
    .interpolate(interpolateLab)
    .clamp(true)
  return (valor) => escala(valor)
}

/** Polos de la escala de diferencias: cálido = más en el primero, frío = más en el segundo. */
export const POLO_CALIDO = '#f0894a'
export const POLO_FRIO = '#3fb3e8'
export const NEUTRO_DIFERENCIA = '#23263a'

/** Escala divergente −max … 0 … +max con punto medio neutro. */
export function escalaDivergente(maxAbs: number): (valor: number) => string {
  const tope = maxAbs > 0 ? maxAbs : 1
  const escala = scaleLinear<string>()
    .domain([-tope, 0, tope])
    .range([POLO_FRIO, NEUTRO_DIFERENCIA, POLO_CALIDO])
    .interpolate(interpolateLab)
    .clamp(true)
  return (valor) => escala(valor)
}
