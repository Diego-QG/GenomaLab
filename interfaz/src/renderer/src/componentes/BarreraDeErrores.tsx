// Barrera de errores (error boundary de React): si algo dentro se cae al dibujarse,
// en vez de dejar toda la ventana en negro se muestra `alternativa` solo en esa parte.
// Nota: React no las usa para errores dentro de manejadores de eventos (onClick…);
// esos no desmontan la app, pero hay que cuidarlos en su propio código.

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Nombre de la zona protegida, para el registro en la consola de DevTools. */
  zona: string
  /** Si cambia, la barrera se reinicia y vuelve a intentar dibujar su contenido. */
  claveReinicio?: unknown
  alternativa: (error: Error, reintentar: () => void) => ReactNode
  children: ReactNode
}

interface Estado {
  error: Error | null
}

export class BarreraDeErrores extends Component<Props, Estado> {
  state: Estado = { error: null }

  static getDerivedStateFromError(error: unknown): Estado {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[Genoma Lab] Se cayó «${this.props.zona}»:`, error, info.componentStack)
  }

  componentDidUpdate(previas: Props): void {
    if (this.state.error !== null && !Object.is(previas.claveReinicio, this.props.claveReinicio)) {
      this.setState({ error: null })
    }
  }

  reintentar = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error !== null) return this.props.alternativa(this.state.error, this.reintentar)
    return this.props.children
  }
}
