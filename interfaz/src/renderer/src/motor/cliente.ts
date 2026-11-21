// Cliente del motor para la interfaz. Todo pedido pasa por window.genoma.ejecutar(),
// que en el proceso principal ejecuta el .exe del motor en C++.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Comandos, NombreComando } from '@compartido/contrato'
import { validarRespuesta } from '@compartido/validacion'
import { useAvisos } from './avisos'

export class ErrorDelMotor extends Error {
  /** true si el motor sí respondió, pero sin algún campo imprescindible del contrato. */
  readonly incompleta: boolean

  constructor(mensaje: string, incompleta = false) {
    super(mensaje)
    this.name = 'ErrorDelMotor'
    this.incompleta = incompleta
  }
}

// Las respuestas no cambian mientras no cambie el FASTA ni el motor, así que se
// guardan para no relanzar el motor al volver a una pantalla.
const guardadas = new Map<string, Promise<unknown>>()
const MAXIMO_GUARDADAS = 900

function claveDe(comando: string, args: readonly string[]): string {
  return [comando, ...args].join('\u0001')
}

// "Época" de los datos: sube cada vez que cambia quién responde (otro archivo u otro
// .exe). Las consultas en pantalla la observan y se vuelven a pedir a la nueva fuente.
let epoca = 0
const oyentesDeEpoca = new Set<() => void>()

/** Olvida todo lo guardado y avisa a las pantallas (al cambiar de archivo o de motor). */
export function vaciarGuardadas(): void {
  guardadas.clear()
  useAvisos.getState().vaciar() // los avisos eran de la fuente anterior
  epoca++
  for (const oyente of oyentesDeEpoca) oyente()
}

function suscribirAEpoca(oyente: () => void): () => void {
  oyentesDeEpoca.add(oyente)
  return () => oyentesDeEpoca.delete(oyente)
}

/** Número que cambia cuando cambia la fuente de los datos (archivo o motor). */
export function useEpocaDelMotor(): number {
  return useSyncExternalStore(suscribirAEpoca, () => epoca)
}

export interface OpcionesPedido {
  /** true = ejecutar de nuevo aunque ya haya una respuesta guardada. */
  fresco?: boolean
  /**
   * false = no guardar la respuesta completa (los pedidos en lote de motor/lote.ts
   * guardan solo lo que usan, para no llenar la memoria con cientos de respuestas).
   */
  guardar?: boolean
}

/**
 * Ejecuta un comando del motor y revisa que la respuesta cumpla el contrato.
 * - Si responde { ok: false } o le falta un campo imprescindible, rechaza con ErrorDelMotor.
 * - Si le faltan campos que se pueden suplir, resuelve con lo que sí llegó (y lo
 *   que faltaba suplido, ver validacion.ts) y deja un aviso con el comando y los campos.
 */
export function pedir<C extends NombreComando>(comando: C, args: readonly string[] = [], opciones: OpcionesPedido = {}): Promise<Comandos[C]> {
  const clave = claveDe(comando, args)
  if (!opciones.fresco) {
    const previa = guardadas.get(clave)
    if (previa) return previa as Promise<Comandos[C]>
  }
  const epocaDelPedido = epoca
  const promesa = window.genoma.ejecutar(comando, [...args]).then((respuesta) => {
    if (!respuesta.ok) throw new ErrorDelMotor(respuesta.error)
    const revision = validarRespuesta(comando, respuesta, args)
    // Una respuesta de la fuente anterior (otro archivo u otro motor) ya no merece aviso
    if (revision.problemas.length > 0 && epocaDelPedido === epoca) {
      useAvisos.getState().anotar(comando, args, revision.problemas, !revision.valida)
    }
    if (!revision.valida) throw new ErrorDelMotor(revision.mensaje, true)
    return revision.datos
  })
  if (opciones.guardar === false) return promesa
  if (guardadas.size >= MAXIMO_GUARDADAS) guardadas.clear()
  guardadas.set(clave, promesa)
  promesa.catch(() => {
    if (guardadas.get(clave) === promesa) guardadas.delete(clave) // los errores no se guardan
  })
  return promesa
}

export interface Consulta<T> {
  datos: T | undefined
  error: string | null
  cargando: boolean
  /** Vuelve a ejecutar el comando en el motor. */
  recargar: () => void
}

interface EstadoConsulta {
  clave: string
  epoca: number
  datos?: unknown
  error?: string
}

/**
 * Pide un comando al motor desde un componente.
 * `args` = null deja la consulta en pausa (por ejemplo, si todavía no hay virus elegido).
 */
export function useMotor<C extends NombreComando>(comando: C, args: readonly string[] | null): Consulta<Comandos[C]> {
  const clave = args === null ? null : claveDe(comando, args)
  const [estado, setEstado] = useState<EstadoConsulta | null>(null)
  const [vuelta, setVuelta] = useState(0)
  const epocaActual = useEpocaDelMotor()
  const argsActuales = useRef(args)
  argsActuales.current = args
  const vueltaAtendida = useRef(0)

  useEffect(() => {
    const argumentos = argsActuales.current
    if (clave === null || argumentos === null) return
    let vigente = true
    const fresco = vuelta !== vueltaAtendida.current // solo si se pidió recargar
    vueltaAtendida.current = vuelta
    pedir(comando, argumentos, { fresco }).then(
      (datos) => {
        if (vigente) setEstado({ clave, epoca: epocaActual, datos })
      },
      (e: unknown) => {
        if (vigente) setEstado({ clave, epoca: epocaActual, error: e instanceof Error ? e.message : String(e) })
      },
    )
    return () => {
      vigente = false
    }
  }, [comando, clave, vuelta, epocaActual])

  const recargar = useCallback(() => setVuelta((v) => v + 1), [])

  const alDia = estado !== null && estado.clave === clave && estado.epoca === epocaActual
  return {
    datos: alDia ? (estado.datos as Comandos[C] | undefined) : undefined,
    error: alDia ? (estado.error ?? null) : null,
    cargando: clave !== null && !alDia,
    recargar,
  }
}
