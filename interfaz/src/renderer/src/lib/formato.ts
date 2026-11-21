// Formato de números y textos para mostrar (no calcula nada del dominio).

const ENTERO = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0, useGrouping: true })

/** Lo que se muestra en lugar de un número que el motor no envió (queda como NaN, ver validacion.ts). */
export const SIN_DATO = '—'

function esNumero(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** 25198 → "25 198" (separador fino, no se confunde con decimales). */
export function entero(n: number): string {
  if (!esNumero(n)) return SIN_DATO
  return ENTERO.format(n).replace(/[.,\s]/g, ' ')
}

export function decimal(n: number, decimales = 2): string {
  if (!esNumero(n)) return SIN_DATO
  return n.toFixed(decimales)
}

/** Separa un número enorme escrito como texto en grupos de tres: "845123908812" → "845 123 908 812". */
export function agruparDigitos(texto: string): string {
  return texto.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function plural(n: number, uno: string, varios: string): string {
  return `${entero(n)} ${n === 1 ? uno : varios}`
}

export function clases(...partes: (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(' ')
}

export function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor))
}
