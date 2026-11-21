import type { ReactNode } from 'react'
import {
  Columns2,
  Dna,
  FlaskConical,
  LayoutGrid,
  ListTree,
  Orbit,
  Presentation,
  Rows3,
  ScanLine,
  Search,
  Users,
  Waypoints,
  X,
  type LucideIcon,
} from 'lucide-react'
import { motorListo } from '@compartido/puente'
import { useApp, useNombreArchivo, type Pantalla } from '@/estado/app'
import { COLOR_BASE } from '@/lib/colores'
import { clases, entero } from '@/lib/formato'
import { BarreraDeErrores } from '../BarreraDeErrores'
import { SelectorVirus } from '../SelectorVirus'
import { AvisosDelMotor } from './AvisosDelMotor'
import { SinMotor } from './SinMotor'

interface Destino {
  pantalla: Pantalla
  etiqueta: string
  icono: LucideIcon
}

const DATOS: Destino[] = [
  { pantalla: 'inicio', etiqueta: 'Inicio', icono: Dna },
  { pantalla: 'explorador', etiqueta: 'Explorador', icono: LayoutGrid },
  { pantalla: 'detalle', etiqueta: 'Detalle', icono: ScanLine },
]

const ALGORITMOS: Destino[] = [
  { pantalla: 'buscar', etiqueta: 'Buscar', icono: Search },
  { pantalla: 'kmers', etiqueta: 'K-mers', icono: Rows3 },
  { pantalla: 'heap', etiqueta: 'Heap', icono: ListTree },
  { pantalla: 'grafo', etiqueta: 'Grafo', icono: Waypoints },
  { pantalla: 'comparar', etiqueta: 'Comparar', icono: Columns2 },
]

// Vistas que piden un comando al motor para todos los virus
const ANALISIS: Destino[] = [
  { pantalla: 'parecidos', etiqueta: '¿A quién se parece?', icono: Users },
  { pantalla: 'galaxia', etiqueta: 'Galaxia', icono: Orbit },
  { pantalla: 'experimentos', etiqueta: 'Experimentos', icono: FlaskConical },
]

/** Pantallas que trabajan sobre un virus concreto (muestran el selector arriba). */
const CON_VIRUS: readonly Pantalla[] = ['detalle', 'kmers', 'heap', 'grafo']

function Marca() {
  return (
    <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
      <span className="flex h-4 items-end gap-[3px]" aria-hidden>
        {(['A', 'C', 'G', 'T'] as const).map((b, i) => (
          <span key={b} className="w-[3px] rounded-full" style={{ background: COLOR_BASE[b], height: `${[100, 55, 80, 40][i]}%` }} />
        ))}
      </span>
      <span className="text-[0.95rem] font-bold tracking-tight" style={{ fontStretch: '118%' }}>
        Genoma Lab
      </span>
    </div>
  )
}

function BarraSuperior() {
  const resumen = useApp((s) => s.resumen)
  const nombreArchivo = useNombreArchivo()
  const pantalla = useApp((s) => s.pantalla)
  const virusActual = useApp((s) => s.virusActual)
  const elegirVirus = useApp((s) => s.elegirVirus)
  const presentacion = useApp((s) => s.presentacion)
  const fijarPresentacion = useApp((s) => s.fijarPresentacion)

  return (
    <header className={clases('arrastrable col-span-2 flex h-11 items-center gap-5 border-b border-linea bg-fondo pl-4', presentacion ? 'pr-3' : 'pr-[150px]')}>
      <Marca />

      {resumen && (
        <div className="flex min-w-0 items-baseline gap-2 text-xs">
          <span className="mono truncate text-tinta-2">{nombreArchivo}</span>
          <span className="shrink-0 text-tinta-3">{entero(resumen.total)} virus</span>
        </div>
      )}

      <div className="flex-1" />

      {resumen && CON_VIRUS.includes(pantalla) && (
        <div className="no-arrastrable">
          <BarreraDeErrores zona="selector de virus" claveReinicio={resumen} alternativa={() => null}>
            <SelectorVirus valor={virusActual} alElegir={elegirVirus} etiqueta="Virus en estudio" alineacion="derecha" />
          </BarreraDeErrores>
        </div>
      )}

      <BarreraDeErrores zona="avisos del motor" alternativa={() => null}>
        <AvisosDelMotor />
      </BarreraDeErrores>

      <div className="no-arrastrable flex items-center gap-1">
        <button
          type="button"
          onClick={() => fijarPresentacion(!presentacion)}
          title={presentacion ? 'Salir del modo presentación (Esc)' : 'Modo presentación: pantalla completa y letra más grande (F11)'}
          aria-pressed={presentacion}
          className={clases(
            'flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-xs transition-colors',
            presentacion ? 'bg-superficie-3 text-tinta' : 'text-tinta-2 hover:bg-superficie-2 hover:text-tinta',
          )}
        >
          {presentacion ? <X size={15} /> : <Presentation size={15} />}
          {presentacion ? 'Salir de presentación' : 'Presentación'}
        </button>
      </div>
    </header>
  )
}

function Riel() {
  const pantalla = useApp((s) => s.pantalla)
  const ir = useApp((s) => s.ir)
  const hayDatos = useApp((s) => s.resumen !== null)
  const compacto = useApp((s) => s.presentacion)

  const enlace = (d: Destino): ReactNode => {
    const activo = d.pantalla === pantalla
    const disponible = d.pantalla === 'inicio' || hayDatos
    return (
      <li key={d.pantalla}>
        <button
          type="button"
          onClick={() => ir(d.pantalla)}
          disabled={!disponible}
          aria-current={activo ? 'page' : undefined}
          title={disponible ? d.etiqueta : `${d.etiqueta}: primero carga un archivo FASTA`}
          data-nav={d.pantalla}
          className={clases(
            'relative flex h-9 w-full items-center gap-3 rounded-md text-sm transition-colors',
            compacto ? 'justify-center px-0' : 'px-3',
            activo ? 'bg-superficie-2 text-tinta' : 'text-tinta-2 hover:bg-superficie hover:text-tinta',
            !disponible && 'cursor-default opacity-35 hover:bg-transparent hover:text-tinta-2',
          )}
        >
          {activo && <span className="absolute -left-2 top-2 h-5 w-[3px] rounded-full bg-hueso" />}
          <d.icono size={16} strokeWidth={activo ? 2.2 : 1.8} className="shrink-0" />
          {!compacto && <span className="truncate">{d.etiqueta}</span>}
        </button>
      </li>
    )
  }

  return (
    <nav aria-label="Pantallas" className={clases('flex shrink-0 flex-col border-r border-linea bg-fondo py-3', compacto ? 'w-14 px-2' : 'w-48 px-2')}>
      <ul className="space-y-0.5">{DATOS.map(enlace)}</ul>
      <div className="mx-1 my-3 border-t border-linea" />
      {!compacto && <div className="mb-1.5 px-3 text-xs text-tinta-3">Algoritmos por dentro</div>}
      <ul className="space-y-0.5">{ALGORITMOS.map(enlace)}</ul>
      <div className="mx-1 my-3 border-t border-linea" />
      {!compacto && <div className="mb-1.5 px-3 text-xs text-tinta-3">Análisis</div>}
      <ul className="space-y-0.5">{ANALISIS.map(enlace)}</ul>
    </nav>
  )
}

/**
 * El marco fijo de la app: barra superior, navegación y escena. Si el motor no
 * está o no responde, la escena es el aviso para compilarlo.
 */
export function Marco({ children }: { children: ReactNode }) {
  const motor = useApp((s) => s.motor)
  const sinMotor = motor !== null && !motorListo(motor)
  return (
    <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]">
      <BarraSuperior />
      <Riel />
      <main className="relative min-h-0 min-w-0 overflow-hidden">{sinMotor ? <SinMotor motor={motor} /> : children}</main>
    </div>
  )
}
