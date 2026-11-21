import { useLayoutEffect, useState, type RefObject } from 'react'

export interface Medida {
  ancho: number
  alto: number
}

/** Tamaño de un elemento en píxeles CSS, actualizado cuando cambia. */
export function useMedida(ref: RefObject<HTMLElement | null>): Medida {
  const [medida, setMedida] = useState<Medida>({ ancho: 0, alto: 0 })

  useLayoutEffect(() => {
    const elemento = ref.current
    if (!elemento) return
    const medir = (): void => {
      const ancho = elemento.clientWidth
      const alto = elemento.clientHeight
      setMedida((previa) => (previa.ancho === ancho && previa.alto === alto ? previa : { ancho, alto }))
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [ref])

  return medida
}
