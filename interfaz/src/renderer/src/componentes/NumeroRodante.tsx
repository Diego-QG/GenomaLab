import { clases } from '@/lib/formato'

/**
 * Un número (escrito como texto, porque los hashes no caben en un number de
 * JavaScript) cuyos dígitos entran rodando cuando cambian. Alineado a la
 * derecha: las unidades no se mueven de sitio.
 */
export function NumeroRodante({ valor, className }: { valor: string; className?: string }) {
  const n = valor.length
  return (
    <span className={clases('mono cifras inline-flex', className)} aria-label={valor}>
      {[...valor].map((digito, i) => {
        const desdeLaDerecha = n - 1 - i
        return (
          // La clave incluye el dígito: al cambiar, el span se vuelve a montar y se anima.
          <span
            key={`${desdeLaDerecha}:${digito}`}
            className={clases('inline-block animate-rodar', desdeLaDerecha > 0 && desdeLaDerecha % 3 === 0 && 'mr-[0.28em]')}
            aria-hidden
          >
            {digito}
          </span>
        )
      })}
    </span>
  )
}
