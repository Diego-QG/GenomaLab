// Lo que se ve en lugar de una parte de la app que se cayó al dibujarse
// (las alternativas de BarreraDeErrores).

import { CircleAlert, RotateCcw, RefreshCw } from 'lucide-react'
import { Boton } from '@/componentes/ui'
import { useApp, type Pantalla } from '@/estado/app'

const NOMBRE_PANTALLA: Record<Pantalla, string> = {
  inicio: 'Inicio',
  explorador: 'Explorador',
  detalle: 'Detalle',
  buscar: 'Buscar',
  kmers: 'K-mers',
  heap: 'Heap',
  grafo: 'Grafo',
  comparar: 'Comparar',
  parecidos: '¿A quién se parece?',
  galaxia: 'Galaxia',
  experimentos: 'Experimentos',
}

/** Una pantalla que se cayó: el marco y la navegación siguen funcionando. */
export function PantallaCaida({ pantalla, error, alReintentar }: { pantalla: Pantalla; error: Error; alReintentar: () => void }) {
  const hayDatos = useApp((s) => s.resumen !== null)
  const ir = useApp((s) => s.ir)
  const destino: Pantalla | null = pantalla === 'inicio' ? null : pantalla !== 'explorador' && hayDatos ? 'explorador' : 'inicio'

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center" role="alert" data-pantalla-caida={pantalla}>
      <CircleAlert size={24} className="text-mal" />
      <h1 className="text-lg">La pantalla {NOMBRE_PANTALLA[pantalla]} se detuvo por un error</h1>
      <p className="mono max-w-2xl select-text text-xs leading-relaxed text-tinta-2">{error.message || String(error)}</p>
      <p className="max-w-xl text-sm text-tinta-3">
        Lo más probable es que una respuesta del motor no tenga la forma que espera esta pantalla. El resto de la app sigue funcionando: puedes
        ir a otra pantalla o elegir otro virus.
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Boton onClick={alReintentar} icono={<RotateCcw size={14} />}>
          Volver a intentar
        </Boton>
        {destino && <Boton onClick={() => ir(destino)}>Ir a {NOMBRE_PANTALLA[destino]}</Boton>}
      </div>
    </div>
  )
}

/**
 * Último recurso, para la app entera. No usa el estado global ni el marco
 * (pueden ser justo lo que falló): solo el mensaje y dos salidas.
 */
export function AppCaida({ error, alReintentar }: { error: Error; alReintentar: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-fondo px-8 text-center text-tinta" role="alert" id="app-caida">
      <CircleAlert size={26} className="text-mal" />
      <h1 className="text-xl">Genoma Lab se detuvo por un error</h1>
      <p className="mono max-w-2xl select-text text-xs leading-relaxed text-tinta-2">{error.message || String(error)}</p>
      <p className="max-w-xl text-sm text-tinta-3">Prueba a volver a intentar; si se repite, recarga la ventana (el archivo cargado se vuelve a pedir desde Inicio).</p>
      <div className="mt-1 flex gap-2">
        <Boton onClick={alReintentar} icono={<RotateCcw size={14} />}>
          Volver a intentar
        </Boton>
        <Boton variante="primario" onClick={() => window.location.reload()} icono={<RefreshCw size={14} />}>
          Recargar la ventana
        </Boton>
      </div>
    </div>
  )
}
