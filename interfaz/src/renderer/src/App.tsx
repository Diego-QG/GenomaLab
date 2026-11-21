import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { BarreraDeErrores } from '@/componentes/BarreraDeErrores'
import { PantallaCaida } from '@/componentes/Caidas'
import { Marco } from '@/componentes/marco/Marco'
import { useApp, type Pantalla } from '@/estado/app'
import { useEpocaDelMotor } from '@/motor/cliente'
import { Buscar } from '@/pantallas/buscar/Buscar'
import { Comparar } from '@/pantallas/comparar/Comparar'
import { Detalle } from '@/pantallas/detalle/Detalle'
import { Experimentos } from '@/pantallas/experimentos/Experimentos'
import { Explorador } from '@/pantallas/explorador/Explorador'
import { Galaxia } from '@/pantallas/galaxia/Galaxia'
import { Grafo } from '@/pantallas/grafo/Grafo'
import { Heap } from '@/pantallas/heap/Heap'
import { Inicio } from '@/pantallas/inicio/Inicio'
import { Kmers } from '@/pantallas/kmers/Kmers'
import { Parecidos } from '@/pantallas/parecidos/Parecidos'

function pantallaActual(pantalla: Pantalla): ReactNode {
  switch (pantalla) {
    case 'inicio':
      return <Inicio />
    case 'explorador':
      return <Explorador />
    case 'detalle':
      return <Detalle />
    case 'buscar':
      return <Buscar />
    case 'kmers':
      return <Kmers />
    case 'heap':
      return <Heap />
    case 'grafo':
      return <Grafo />
    case 'comparar':
      return <Comparar />
    case 'parecidos':
      return <Parecidos />
    case 'galaxia':
      return <Galaxia />
    case 'experimentos':
      return <Experimentos />
  }
}

export function App() {
  const iniciar = useApp((s) => s.iniciar)
  const pantalla = useApp((s) => s.pantalla)
  // Si la pantalla se cayó, se vuelve a intentar sola al cambiar de fuente o de virus
  const epoca = useEpocaDelMotor()
  const virusActual = useApp((s) => s.virusActual)
  const virusComparado = useApp((s) => s.virusComparado)
  const claveReinicio = `${epoca}|${virusActual ?? ''}|${virusComparado ?? ''}`

  useEffect(() => {
    void iniciar()
  }, [iniciar])

  // Esc sale del modo presentación (F11 lo atiende el proceso principal).
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent): void => {
      const { presentacion, fijarPresentacion } = useApp.getState()
      if (e.key === 'Escape' && presentacion) fijarPresentacion(false)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <Marco>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pantalla}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <BarreraDeErrores
              zona={`pantalla ${pantalla}`}
              claveReinicio={claveReinicio}
              alternativa={(error, reintentar) => <PantallaCaida pantalla={pantalla} error={error} alReintentar={reintentar} />}
            >
              {pantallaActual(pantalla)}
            </BarreraDeErrores>
          </motion.div>
        </AnimatePresence>
      </Marco>
    </MotionConfig>
  )
}
