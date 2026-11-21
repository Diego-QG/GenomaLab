// Preload: expone a la interfaz un puente mínimo y tipado (window.genoma).
// La interfaz no tiene acceso a Node ni al sistema de archivos: solo a estas funciones.

import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { PuenteGenoma } from '@compartido/puente'

function escuchar<T>(canal: string, oyente: (dato: T) => void): () => void {
  const manejador = (_evento: IpcRendererEvent, dato: T): void => oyente(dato)
  ipcRenderer.on(canal, manejador)
  return () => {
    ipcRenderer.removeListener(canal, manejador)
  }
}

const puente: PuenteGenoma = {
  ejecutar: (comando, args = []) => ipcRenderer.invoke('motor:ejecutar', comando, args),
  estado: () => ipcRenderer.invoke('motor:estado'),
  buscarMotor: () => ipcRenderer.invoke('motor:buscar'),
  usarFasta: (ruta) => ipcRenderer.invoke('fasta:usar', ruta),
  // La ruta real del archivo soltado se resuelve aquí y va directo al proceso principal.
  usarArchivoSoltado: (archivo) => {
    const ruta = webUtils.getPathForFile(archivo)
    if (!ruta) return Promise.reject(new Error('Ese archivo no viene del disco: arrástralo desde el Explorador de Windows o usa "Elegir archivo…".'))
    return ipcRenderer.invoke('fasta:usar', ruta)
  },
  elegirFasta: () => ipcRenderer.invoke('fasta:elegir'),
  pantallaCompleta: (activa) => ipcRenderer.invoke('ventana:pantallaCompleta', activa),
  alCambiarEstado: (oyente) => escuchar('motor:estado', oyente),
  alCambiarPantallaCompleta: (oyente) => escuchar('ventana:pantallaCompleta', oyente),
}

contextBridge.exposeInMainWorld('genoma', puente)
