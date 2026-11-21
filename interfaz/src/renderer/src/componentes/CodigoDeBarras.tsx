import { useEffect, useRef, useState } from 'react'
import { pedir, useEpocaDelMotor } from '@/motor/cliente'
import { colorDeBase } from '@/lib/colores'

/** Dibuja una secuencia como franjas de color: una muestra de bases repartida a lo ancho. */
export function dibujarFranjas(lienzo: HTMLCanvasElement, secuencia: string, ancho: number, alto: number, paso = 3, grosor = 2): void {
  const dpr = window.devicePixelRatio || 1
  lienzo.width = Math.max(1, Math.round(ancho * dpr))
  lienzo.height = Math.max(1, Math.round(alto * dpr))
  const ctx = lienzo.getContext('2d')
  if (!ctx || secuencia.length === 0) return
  ctx.scale(dpr, dpr)
  const franjas = Math.max(1, Math.floor(ancho / paso))
  for (let i = 0; i < franjas; i++) {
    const letra = secuencia[Math.floor((i / franjas) * secuencia.length)]
    ctx.fillStyle = colorDeBase(letra)
    ctx.fillRect(i * paso, 0, grosor, alto)
  }
}

interface Props {
  id: string
  ancho: number
  alto?: number
}

/**
 * Mini "código de barras" de un virus. La secuencia se pide al motor
 * (comando `virus <id>`) solo cuando la tarjeta está a la vista.
 */
export function CodigoDeBarras({ id, ancho, alto = 22 }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [secuencia, setSecuencia] = useState<string | null>(null)
  const epoca = useEpocaDelMotor() // cambia si cambia el archivo o el motor

  useEffect(() => {
    let vigente = true
    setSecuencia(null)
    // Pequeña espera: si la tarjeta solo pasa de largo al desplazar, no se pide nada.
    const espera = window.setTimeout(() => {
      pedir('virus', [id]).then(
        (v) => {
          if (vigente) setSecuencia(v.secuencia)
        },
        () => {
          // Sin secuencia no hay franjas; la tarjeta sigue mostrando sus datos.
        },
      )
    }, 70)
    return () => {
      vigente = false
      window.clearTimeout(espera)
    }
  }, [id, epoca])

  useEffect(() => {
    if (lienzo.current && secuencia !== null && ancho > 0) dibujarFranjas(lienzo.current, secuencia, ancho, alto)
  }, [secuencia, ancho, alto])

  return (
    <div className="overflow-hidden rounded-[3px] bg-superficie-3/60" style={{ width: ancho, height: alto }}>
      <canvas
        ref={lienzo}
        className="block transition-opacity duration-300"
        style={{ width: ancho, height: alto, opacity: secuencia === null ? 0 : 1 }}
        aria-hidden
      />
    </div>
  )
}
