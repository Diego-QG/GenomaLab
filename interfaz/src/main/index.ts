// Proceso principal de Electron: crea la ventana y atiende a la interfaz por IPC.

import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { alCambiarEstado, buscarDeNuevo, ejecutarMotor, estadoMotor, iniciarMotor, usarFasta } from './motor'

const COLOR_DE_FONDO = '#0b0c14'
const ZOOM_PRESENTACION = 1.2
const urlDesarrollo = process.env.ELECTRON_RENDERER_URL
const archivoInterfaz = join(__dirname, '../renderer/index.html')

let ventana: BrowserWindow | null = null

function crearVentana(): void {
  const nueva = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'Genoma Lab',
    backgroundColor: COLOR_DE_FONDO,
    autoHideMenuBar: true,
    // Barra de título propia, con los botones nativos de Windows encima
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: COLOR_DE_FONDO, symbolColor: '#a9aec4', height: 44 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  ventana = nueva

  nueva.once('ready-to-show', () => nueva.show())
  nueva.on('closed', () => {
    if (ventana === nueva) ventana = null
  })

  // La interfaz es local: no se abren ventanas nuevas ni se navega a otro sitio
  // (por ejemplo, al soltar un archivo fuera de la zona de carga).
  nueva.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  nueva.webContents.on('will-navigate', (evento, url) => {
    const permitida = urlDesarrollo ? url.startsWith(urlDesarrollo) : url === pathToFileURL(archivoInterfaz).href
    if (!permitida) evento.preventDefault()
  })

  // F11 entra y sale de pantalla completa. Se atiende aquí, antes que el menú de
  // Electron y que la página, para que haya una sola respuesta a la tecla.
  nueva.webContents.on('before-input-event', (evento, tecla) => {
    if (tecla.type === 'keyDown' && tecla.key === 'F11' && !tecla.isAutoRepeat) {
      evento.preventDefault()
      nueva.setFullScreen(!nueva.isFullScreen())
    }
  })

  // Modo presentación = pantalla completa + todo un 20 % más grande
  nueva.on('enter-full-screen', () => {
    nueva.webContents.setZoomFactor(ZOOM_PRESENTACION)
    nueva.webContents.send('ventana:pantallaCompleta', true)
  })
  nueva.on('leave-full-screen', () => {
    nueva.webContents.setZoomFactor(1)
    nueva.webContents.send('ventana:pantallaCompleta', false)
  })

  if (urlDesarrollo) void nueva.loadURL(urlDesarrollo)
  else void nueva.loadFile(archivoInterfaz)
}

function registrarCanales(): void {
  // La única puerta al motor
  ipcMain.handle('motor:ejecutar', (_evento, comando: unknown, args: unknown) => ejecutarMotor(comando, args))
  ipcMain.handle('motor:estado', () => estadoMotor())
  ipcMain.handle('motor:buscar', () => buscarDeNuevo())

  ipcMain.handle('fasta:usar', (_evento, ruta: unknown) => usarFasta(ruta))
  ipcMain.handle('fasta:elegir', async () => {
    if (!ventana) return null
    const eleccion = await dialog.showOpenDialog(ventana, {
      title: 'Elegir archivo FASTA',
      properties: ['openFile'],
      filters: [
        { name: 'FASTA', extensions: ['fasta', 'fa', 'fna', 'fas', 'txt'] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    })
    if (eleccion.canceled || eleccion.filePaths.length === 0) return null
    return usarFasta(eleccion.filePaths[0])
  })

  ipcMain.handle('ventana:pantallaCompleta', (_evento, activa: unknown) => {
    if (!ventana) return false
    ventana.setFullScreen(activa === true)
    return activa === true
  })

  alCambiarEstado((estado) => ventana?.webContents.send('motor:estado', estado))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!ventana) return
    if (ventana.isMinimized()) ventana.restore()
    ventana.focus()
  })

  void app.whenReady().then(async () => {
    if (app.isPackaged) Menu.setApplicationMenu(null)
    registrarCanales()
    await iniciarMotor()
    crearVentana()
  })

  app.on('window-all-closed', () => app.quit())
}
