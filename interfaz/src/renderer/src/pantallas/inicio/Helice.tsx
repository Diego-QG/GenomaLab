// Hélice de ADN en 3D (react-three-fiber). Es decorativa: no usa datos del motor.
// Cuando `desarmar` pasa a true, cada pieza sale disparada y la hélice se
// deshace en partículas (la transición hacia el Explorador).

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLOR_BASE } from '@/lib/colores'

// Un tramo de secuencia solo para dar color a los peldaños
const TRAMO = 'ATGGGATGTCTTGGGAATCAGCTGCTTATCGCCATCTTGC'
const COMPLEMENTO: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' }

const PARES = TRAMO.length
const RADIO = 1.25
const SEPARACION = 0.34
const GIRO = 0.4
const DURACION_DESARME = 1.25

const EJE_Y = new THREE.Vector3(0, 1, 0)

interface Pieza {
  posicion: THREE.Vector3
  giro: THREE.Quaternion
  escala: THREE.Vector3
  /** Hacia dónde sale disparada al desarmarse. */
  rumbo: THREE.Vector3
  ejeDeGiro: THREE.Vector3
  retraso: number
}

function azar(semilla: number): () => number {
  // Generador determinista: la hélice se desarma siempre igual
  let s = semilla
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function piezaEntre(a: THREE.Vector3, b: THREE.Vector3, grosor: number, r: () => number): Pieza {
  const direccion = b.clone().sub(a)
  const largo = direccion.length()
  const centro = a.clone().add(b).multiplyScalar(0.5)
  return {
    posicion: centro,
    giro: new THREE.Quaternion().setFromUnitVectors(EJE_Y, direccion.clone().normalize()),
    escala: new THREE.Vector3(grosor, largo, grosor),
    rumbo: rumboDesde(centro, r),
    ejeDeGiro: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
    retraso: r() * 0.25,
  }
}

function rumboDesde(p: THREE.Vector3, r: () => number): THREE.Vector3 {
  // Hacia afuera del eje, con bastante dispersión y un empujón hacia la cámara
  const afuera = new THREE.Vector3(p.x, 0, p.z)
  if (afuera.lengthSq() < 0.01) afuera.set(r() - 0.5, 0, r() - 0.5)
  afuera.normalize()
  return afuera
    .multiplyScalar(3 + r() * 5)
    .add(new THREE.Vector3((r() - 0.5) * 5, (r() - 0.5) * 7, 1.5 + r() * 5))
}

function construir() {
  const r = azar(7)
  const esferas: Pieza[] = []
  const peldanos: Pieza[] = []
  const colores: THREE.Color[] = []
  const uniones: Pieza[] = []
  const hebras: [THREE.Vector3[], THREE.Vector3[]] = [[], []]

  for (let i = 0; i < PARES; i++) {
    const y = (i - (PARES - 1) / 2) * SEPARACION
    const angulo = i * GIRO
    const p1 = new THREE.Vector3(Math.cos(angulo) * RADIO, y, Math.sin(angulo) * RADIO)
    const p2 = new THREE.Vector3(-p1.x, y, -p1.z)
    const centro = new THREE.Vector3(0, y, 0)
    hebras[0].push(p1)
    hebras[1].push(p2)

    for (const p of [p1, p2]) {
      esferas.push({
        posicion: p,
        giro: new THREE.Quaternion(),
        escala: new THREE.Vector3(1, 1, 1),
        rumbo: rumboDesde(p, r),
        ejeDeGiro: EJE_Y,
        retraso: r() * 0.25,
      })
    }

    // Cada peldaño son dos mitades: la base de una hebra y su complementaria
    const base = TRAMO[i]
    peldanos.push(piezaEntre(p1, centro, 1, r), piezaEntre(centro, p2, 1, r))
    colores.push(new THREE.Color(COLOR_BASE[base]), new THREE.Color(COLOR_BASE[COMPLEMENTO[base]]))
  }

  for (const hebra of hebras) {
    for (let i = 0; i + 1 < hebra.length; i++) uniones.push(piezaEntre(hebra[i], hebra[i + 1], 1, r))
  }
  return { esferas, peldanos, colores, uniones }
}

const auxiliar = new THREE.Object3D()
const giroExtra = new THREE.Quaternion()

/** Coloca las piezas de una malla instanciada según el avance del desarme (0 = armada, 1 = deshecha). */
function colocar(malla: THREE.InstancedMesh, piezas: Pieza[], avance: number): void {
  for (let i = 0; i < piezas.length; i++) {
    const pieza = piezas[i]
    const local = Math.min(1, Math.max(0, (avance - pieza.retraso) / (1 - pieza.retraso)))
    const empuje = 1 - (1 - local) ** 3 // sale rápido y frena
    auxiliar.position.copy(pieza.posicion).addScaledVector(pieza.rumbo, empuje)
    auxiliar.quaternion.copy(pieza.giro)
    if (local > 0) {
      giroExtra.setFromAxisAngle(pieza.ejeDeGiro, empuje * 5)
      auxiliar.quaternion.premultiply(giroExtra)
    }
    const encoge = 1 - local * local
    auxiliar.scale.copy(pieza.escala).multiplyScalar(encoge)
    auxiliar.updateMatrix()
    malla.setMatrixAt(i, auxiliar.matrix)
  }
  malla.instanceMatrix.needsUpdate = true
}

function Modelo({ desarmar }: { desarmar: boolean }) {
  const { esferas, peldanos, colores, uniones } = useMemo(construir, [])
  const grupo = useRef<THREE.Group>(null)
  const mallaEsferas = useRef<THREE.InstancedMesh>(null)
  const mallaPeldanos = useRef<THREE.InstancedMesh>(null)
  const mallaUniones = useRef<THREE.InstancedMesh>(null)
  const avance = useRef(0)

  useLayoutEffect(() => {
    if (!mallaEsferas.current || !mallaPeldanos.current || !mallaUniones.current) return
    colocar(mallaEsferas.current, esferas, 0)
    colocar(mallaPeldanos.current, peldanos, 0)
    colocar(mallaUniones.current, uniones, 0)
    colores.forEach((color, i) => mallaPeldanos.current?.setColorAt(i, color))
    if (mallaPeldanos.current.instanceColor) mallaPeldanos.current.instanceColor.needsUpdate = true
  }, [esferas, peldanos, uniones, colores])

  useEffect(() => {
    if (!desarmar) avance.current = 0
  }, [desarmar])

  useFrame((_estado, delta) => {
    const dt = Math.min(delta, 0.05)
    if (grupo.current) grupo.current.rotation.y += dt * (desarmar ? 1.4 : 0.32)
    const objetivo = desarmar ? 1 : 0
    if (avance.current !== objetivo || avance.current > 0) {
      avance.current = desarmar ? Math.min(1, avance.current + dt / DURACION_DESARME) : 0
      if (mallaEsferas.current) colocar(mallaEsferas.current, esferas, avance.current)
      if (mallaPeldanos.current) colocar(mallaPeldanos.current, peldanos, avance.current)
      if (mallaUniones.current) colocar(mallaUniones.current, uniones, avance.current)
    }
  })

  return (
    <group rotation={[0.12, 0, -0.38]}>
      <group ref={grupo}>
        <instancedMesh ref={mallaEsferas} args={[undefined, undefined, esferas.length]} frustumCulled={false}>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial color="#dfe2f2" roughness={0.35} metalness={0.15} />
        </instancedMesh>
        <instancedMesh ref={mallaUniones} args={[undefined, undefined, uniones.length]} frustumCulled={false}>
          <cylinderGeometry args={[0.055, 0.055, 1, 10]} />
          <meshStandardMaterial color="#8f95b3" roughness={0.5} metalness={0.1} />
        </instancedMesh>
        <instancedMesh ref={mallaPeldanos} args={[undefined, undefined, peldanos.length]} frustumCulled={false}>
          <cylinderGeometry args={[0.07, 0.07, 1, 12]} />
          <meshStandardMaterial roughness={0.3} metalness={0.05} emissive="#ffffff" emissiveIntensity={0.06} />
        </instancedMesh>
      </group>
    </group>
  )
}

function Polvo() {
  const puntos = useRef<THREE.Points>(null)
  const posiciones = useMemo(() => {
    const r = azar(21)
    const datos = new Float32Array(260 * 3)
    for (let i = 0; i < 260; i++) {
      datos[i * 3] = (r() - 0.5) * 16
      datos[i * 3 + 1] = (r() - 0.5) * 14
      datos[i * 3 + 2] = (r() - 0.5) * 8 - 2
    }
    return datos
  }, [])

  useFrame((_estado, delta) => {
    if (puntos.current) puntos.current.rotation.y += Math.min(delta, 0.05) * 0.02
  })

  return (
    <points ref={puntos}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posiciones, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#b3a4ff" size={0.035} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
    </points>
  )
}

export function Helice({ desarmar }: { desarmar: boolean }) {
  return (
    <Canvas flat dpr={[1, 2]} camera={{ position: [0, 0, 13], fov: 36 }} gl={{ antialias: true, alpha: true }} aria-hidden>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 8]} intensity={2.2} />
      <pointLight position={[-6, -2, 4]} intensity={40} color="#7a63e8" />
      <pointLight position={[5, 3, -4]} intensity={30} color="#4a8fe8" />
      <Polvo />
      <Modelo desarmar={desarmar} />
    </Canvas>
  )
}
