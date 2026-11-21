// Pedidos en lote: el mismo comando del motor para muchos virus (¿A quién se parece?,
// Galaxia, Experimentos).
//
//  · Como mucho PROCESOS_A_LA_VEZ procesos del .exe a la vez.
//  · De cada respuesta se guarda solo lo que la vista usa, en una caché que dura toda
//    la sesión (se vacía al cambiar de archivo o de motor).
//  · Un trabajo se pausa cuando ninguna pantalla lo mira y sigue donde iba al volver.
//  · Si un pedido falla, el trabajo se detiene y muestra el error; al reintentar, lo
//    que ya llegó no se vuelve a pedir.

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useEpocaDelMotor } from './cliente'

export const PROCESOS_A_LA_VEZ = 4

export interface ItemLote<T> {
  /** Identifica el resultado en la caché de la sesión (por ejemplo "kmers|<id>|3"). */
  clave: string
  /** Pide el comando al motor y se queda con lo que hace falta de la respuesta. */
  ejecutar: () => Promise<T>
}

export interface EstadoLote<T> {
  total: number
  hechos: number
  /** Los resultados en el orden de los items; null hasta que llegan todos. */
  valores: T[] | null
  error: string | null
  reintentar: () => void
}

interface Trabajo {
  epoca: number
  items: ItemLote<unknown>[]
  hechos: number
  error: string | null
  corriendo: boolean
  version: number
  oyentes: Set<() => void>
}

const cache = new Map<string, unknown>()
const enCurso = new Map<string, Promise<unknown>>()
const trabajos = new Map<string, Trabajo>()
let epocaDeLaCache = -1

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Si cambió el archivo o el motor, lo guardado ya no vale. */
function alinearEpoca(epoca: number): void {
  if (epoca === epocaDeLaCache) return
  epocaDeLaCache = epoca
  cache.clear()
  enCurso.clear()
  trabajos.clear()
}

/** Un mismo item pedido por dos trabajos (k = 3 en Galaxia y Experimentos) se ejecuta una vez. */
function ejecutarItem(item: ItemLote<unknown>, epoca: number): Promise<unknown> {
  const previo = enCurso.get(item.clave)
  if (previo) return previo
  const promesa = item.ejecutar().then((valor) => {
    if (epoca === epocaDeLaCache) cache.set(item.clave, valor)
    return valor
  })
  enCurso.set(item.clave, promesa)
  const soltar = (): void => {
    if (enCurso.get(item.clave) === promesa) enCurso.delete(item.clave)
  }
  promesa.then(soltar, soltar)
  return promesa
}

function avisar(t: Trabajo): void {
  t.version++
  for (const oyente of t.oyentes) oyente()
}

function contarHechos(t: Trabajo): number {
  let hechos = 0
  for (const item of t.items) if (cache.has(item.clave)) hechos++
  return hechos
}

function arrancar(t: Trabajo): void {
  if (t.corriendo || t.error !== null || t.epoca !== epocaDeLaCache) return
  const pendientes = t.items.filter((item) => !cache.has(item.clave))
  t.hechos = t.items.length - pendientes.length
  if (pendientes.length === 0) return
  t.corriendo = true
  let siguiente = 0
  const sigue = (): boolean => t.oyentes.size > 0 && t.error === null && t.epoca === epocaDeLaCache

  const trabajador = async (): Promise<void> => {
    while (siguiente < pendientes.length && sigue()) {
      const item = pendientes[siguiente++]
      try {
        await ejecutarItem(item, t.epoca)
      } catch (e) {
        if (t.error === null) t.error = mensajeDe(e)
      }
      if (t.epoca !== epocaDeLaCache) return
      t.hechos = contarHechos(t)
      avisar(t)
    }
  }

  void Promise.all(Array.from({ length: Math.min(PROCESOS_A_LA_VEZ, pendientes.length) }, trabajador)).then(() => {
    t.corriendo = false
    if (t.epoca !== epocaDeLaCache) return
    t.hechos = contarHechos(t)
    avisar(t)
    // Si alguien volvió a mirar mientras terminaban los últimos pedidos, se sigue
    if (t.oyentes.size > 0) arrancar(t)
  })
}

function trabajoPara(clave: string, epoca: number, crearItems: () => ItemLote<unknown>[]): Trabajo {
  alinearEpoca(epoca)
  let t = trabajos.get(clave)
  if (!t) {
    const items = crearItems()
    t = { epoca, items, hechos: 0, error: null, corriendo: false, version: 0, oyentes: new Set() }
    t.hechos = contarHechos(t)
    trabajos.set(clave, t)
  }
  return t
}

/**
 * Ejecuta en lote los pedidos de `crearItems` mientras la pantalla esté abierta.
 * `clave` identifica el trabajo (por ejemplo "parecidos|<id>"); null = en pausa.
 * `crearItems` se llama una vez por trabajo y época.
 */
export function useLote<T>(clave: string | null, crearItems: () => ItemLote<T>[]): EstadoLote<T> {
  const epoca = useEpocaDelMotor()
  // crearItems cambia en cada render; el trabajo solo depende de la clave y la época
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trabajo = useMemo(() => (clave === null ? null : trabajoPara(clave, epoca, crearItems as () => ItemLote<unknown>[])), [clave, epoca])

  const suscribir = useCallback(
    (oyente: () => void) => {
      if (!trabajo) return () => undefined
      trabajo.oyentes.add(oyente)
      arrancar(trabajo)
      return () => {
        trabajo.oyentes.delete(oyente)
      }
    },
    [trabajo],
  )
  const version = useSyncExternalStore(suscribir, () => trabajo?.version ?? -1)

  const reintentar = useCallback(() => {
    if (!trabajo) return
    trabajo.error = null
    avisar(trabajo)
    arrancar(trabajo)
  }, [trabajo])

  const valores = useMemo(() => {
    if (!trabajo || trabajo.error !== null) return null
    if (!trabajo.items.every((item) => cache.has(item.clave))) return null
    return trabajo.items.map((item) => cache.get(item.clave) as T)
    // version cambia cada vez que llega un resultado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajo, version])

  return {
    total: trabajo?.items.length ?? 0,
    hechos: trabajo?.hechos ?? 0,
    valores,
    error: trabajo?.error ?? null,
    reintentar,
  }
}
