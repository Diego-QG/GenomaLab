import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/martian-mono/wdth.css'
import './estilos/global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { BarreraDeErrores } from './componentes/BarreraDeErrores'
import { AppCaida } from './componentes/Caidas'

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    {/* Último recurso: si algo se cae fuera de las pantallas, nunca queda la ventana en negro */}
    <BarreraDeErrores zona="app" alternativa={(error, reintentar) => <AppCaida error={error} alReintentar={reintentar} />}>
      <App />
    </BarreraDeErrores>
  </StrictMode>,
)
