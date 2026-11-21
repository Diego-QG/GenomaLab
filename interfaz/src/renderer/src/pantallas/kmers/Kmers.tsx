import { useState } from 'react'
import { Cabecera, Cargando, ErrorDelMotorVisible, Segmentos } from '@/componentes/ui'
import { useApp } from '@/estado/app'
import { useMotor } from '@/motor/cliente'
import { Insercion } from './Insercion'
import { TablaFinal } from './TablaFinal'

type Vista = 'insercion' | 'final'

/**
 * Pantalla 5 — K-mers: la ventana deslizante, las dos tablas hash (sondeo
 * lineal y doble hashing) llenándose a la vez, y el estado final con el top n.
 */
export function Kmers() {
  const id = useApp((s) => s.virusActual)
  const [k, setK] = useState<3 | 6>(3)
  const [n, setN] = useState(10)
  const [limite, setLimite] = useState(400)
  const [vista, setVista] = useState<Vista>('insercion')

  const virus = useMotor('virus', id ? [id] : null)
  const conteo = useMotor('kmers', id && vista === 'final' ? [id, String(k), String(n)] : null)

  if (!id) return <div className="grid h-full place-items-center text-tinta-3">Elige un virus en el Explorador.</div>

  return (
    <div className="flex h-full flex-col">
      <Cabecera
        titulo="K-mers"
        descripcion="Una ventana de k letras recorre la secuencia y cada k-mer se cuenta en una tabla hash de 4ᵏ casillas. A la izquierda, sondeo lineal; a la derecha, doble hashing."
      >
        <Segmentos
          etiqueta="Vista"
          valor={vista}
          alCambiar={setVista}
          opciones={[
            { valor: 'insercion', etiqueta: 'Inserción paso a paso' },
            { valor: 'final', etiqueta: 'Tabla final' },
          ]}
        />
        <Segmentos
          etiqueta="Tamaño del k-mer"
          valor={k}
          alCambiar={setK}
          opciones={[
            { valor: 3, etiqueta: 'k = 3', titulo: 'Tabla de 64 casillas' },
            { valor: 6, etiqueta: 'k = 6', titulo: 'Tabla de 4096 casillas' },
          ]}
        />
        {vista === 'final' && (
          <label className="flex items-center gap-2 text-xs text-tinta-3">
            Top
            <Segmentos
              etiqueta="Cuántos k-mers mostrar en el top"
              valor={n}
              alCambiar={setN}
              opciones={[
                { valor: 5, etiqueta: '5' },
                { valor: 10, etiqueta: '10' },
                { valor: 20, etiqueta: '20' },
              ]}
            />
          </label>
        )}
      </Cabecera>

      <div className="min-h-0 flex-1">
        {vista === 'insercion' ? (
          virus.error ? (
            <ErrorDelMotorVisible error={virus.error} alReintentar={virus.recargar} />
          ) : !virus.datos ? (
            <Cargando texto="Pidiendo la secuencia al motor…" />
          ) : (
            <Insercion key={`${id}:${k}:${limite}`} id={id} k={k} limite={limite} alCambiarLimite={setLimite} secuencia={virus.datos.secuencia} />
          )
        ) : conteo.error ? (
          <ErrorDelMotorVisible error={conteo.error} alReintentar={conteo.recargar} />
        ) : !conteo.datos ? (
          <Cargando texto="El motor está contando los k-mers…" />
        ) : (
          <TablaFinal datos={conteo.datos} />
        )}
      </div>
    </div>
  )
}
