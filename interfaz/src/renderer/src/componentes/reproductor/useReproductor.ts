// El reproductor que comparten todas las animaciones.
//
// Una animación es una lista de pasos; lo que se ve en pantalla es siempre una
// función pura de (traza del motor, número de paso). Así reproducir, pausar,
// avanzar de a un paso o saltar a cualquier punto funcionan igual en todas partes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const VELOCIDADES = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64] as const

export interface Reproductor {
  /** Paso actual, de 0 a total − 1. */
  paso: number
  total: number
  reproduciendo: boolean
  velocidad: number
  enElFinal: boolean
  reproducir: () => void
  pausar: () => void
  alternar: () => void
  siguiente: () => void
  anterior: () => void
  irA: (paso: number) => void
  reiniciar: () => void
  fijarVelocidad: (velocidad: number) => void
  masRapido: () => void
  masLento: () => void
}

export interface OpcionesReproductor {
  /** Duración de cada paso a velocidad 1× (ms). Puede depender del paso. */
  msPorPaso?: number | ((paso: number) => number)
  /** Cuando cambia, la animación vuelve al paso 0 (por ejemplo, al llegar otra traza). */
  clave?: unknown
  /** Empezar a reproducir sola cuando llega una traza nueva. */
  autoinicio?: boolean
  velocidadInicial?: number
}

export function useReproductor(total: number, opciones: OpcionesReproductor = {}): Reproductor {
  const { msPorPaso = 900, clave, autoinicio = false, velocidadInicial = 1 } = opciones
  const [paso, setPaso] = useState(0)
  const [reproduciendo, setReproduciendo] = useState(false)
  const [velocidad, setVelocidad] = useState(velocidadInicial)

  const ultimo = Math.max(0, total - 1)
  const pasoRef = useRef(0)
  pasoRef.current = paso
  const duracion = useRef(msPorPaso)
  duracion.current = msPorPaso

  // Traza nueva → al principio
  useEffect(() => {
    setPaso(0)
    setReproduciendo(autoinicio && total > 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  // Si la traza se acorta, el paso no puede quedar fuera
  useEffect(() => {
    if (paso > ultimo) setPaso(ultimo)
  }, [paso, ultimo])

  // Avance automático: acumula tiempo real y adelanta los pasos que quepan
  // (a velocidades altas pueden ser varios por fotograma).
  useEffect(() => {
    if (!reproduciendo) return
    let cuadro = 0
    let anterior = performance.now()
    let acumulado = 0
    const avanzar = (ahora: number): void => {
      acumulado += Math.min(ahora - anterior, 250) * velocidad
      anterior = ahora
      let actual = pasoRef.current
      let guardia = 0
      while (actual < ultimo && guardia < 2000) {
        const d = typeof duracion.current === 'function' ? duracion.current(actual) : duracion.current
        if (acumulado < d) break
        acumulado -= d
        actual++
        guardia++
      }
      if (actual !== pasoRef.current) {
        pasoRef.current = actual
        setPaso(actual)
      }
      if (actual >= ultimo) {
        setReproduciendo(false)
        return
      }
      cuadro = requestAnimationFrame(avanzar)
    }
    cuadro = requestAnimationFrame(avanzar)
    return () => cancelAnimationFrame(cuadro)
  }, [reproduciendo, velocidad, ultimo])

  const irA = useCallback(
    (destino: number) => {
      const acotado = Math.min(ultimo, Math.max(0, Math.round(destino)))
      pasoRef.current = acotado
      setPaso(acotado)
    },
    [ultimo],
  )

  const reproducir = useCallback(() => {
    if (pasoRef.current >= ultimo) irA(0) // desde el final, vuelve a empezar
    setReproduciendo(ultimo > 0)
  }, [irA, ultimo])

  const pausar = useCallback(() => setReproduciendo(false), [])

  const alternar = useCallback(() => {
    if (reproduciendo) pausar()
    else reproducir()
  }, [reproduciendo, pausar, reproducir])

  const siguiente = useCallback(() => {
    setReproduciendo(false)
    irA(pasoRef.current + 1)
  }, [irA])

  const anterior = useCallback(() => {
    setReproduciendo(false)
    irA(pasoRef.current - 1)
  }, [irA])

  const reiniciar = useCallback(() => {
    setReproduciendo(false)
    irA(0)
  }, [irA])

  const cambiarVelocidad = useCallback((delta: number) => {
    setVelocidad((v) => {
      const i = VELOCIDADES.findIndex((x) => x >= v)
      const base = i < 0 ? VELOCIDADES.length - 1 : i
      return VELOCIDADES[Math.min(VELOCIDADES.length - 1, Math.max(0, base + delta))]
    })
  }, [])

  const masRapido = useCallback(() => cambiarVelocidad(1), [cambiarVelocidad])
  const masLento = useCallback(() => cambiarVelocidad(-1), [cambiarVelocidad])

  return useMemo(
    () => ({
      paso: Math.min(paso, ultimo),
      total,
      reproduciendo,
      velocidad,
      enElFinal: paso >= ultimo,
      reproducir,
      pausar,
      alternar,
      siguiente,
      anterior,
      irA,
      reiniciar,
      fijarVelocidad: setVelocidad,
      masRapido,
      masLento,
    }),
    [paso, ultimo, total, reproduciendo, velocidad, reproducir, pausar, alternar, siguiente, anterior, irA, reiniciar, masRapido, masLento],
  )
}
