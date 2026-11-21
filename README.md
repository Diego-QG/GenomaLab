# Genoma Lab - Proyecto de EDA 2

Proyecto del curso Estructuras de Datos y Algoritmos 2 (Universidad de Lima).
Hecho por: Quispe Gomez, Diego Sebastian - 20244520

El programa lee el archivo `HIV2_ALL_2021_env_DNA.2000.fasta`, que tiene 218 virus (VIH-2 y SIV), y con eso:

- guarda los virus en una tabla hash para buscarlos por su id
- cuenta los k-mers de cada virus en otra tabla hash (con doble hashing)
- saca los k-mers que más se repiten con un max-heap
- arma el grafo de parejas de bases de cada virus (matriz de 16x16)
- compara dos virus con la similitud coseno

Se puede usar desde un menú en consola o desde una interfaz gráfica.

## Qué hice yo y qué hizo la IA

- `estructuras/`: todas las estructuras (FASTA, TablaVirus, TablaKmers, MaxHeap, GrafoPares, Similitud). Lo hice yo.
- `main.cpp`, `Menu.h`, `Menu.cpp`: el programa principal y el menú. Lo hice yo, la IA me ayudó con el formato de los mensajes del menú.
- `puente_interfaz/Comandos.cpp`: los comandos resumen, virus y kmers en JSON. Lo hice yo.
- `puente_interfaz/ComandosIA.cpp` y `Trazas.h/.cpp`: lo hizo la IA (Claude), para que la interfaz pueda animar los pasos.
- `interfaz/`: la app Genoma Lab, la hizo la IA (Claude).
- `externo/json.hpp`: librería nlohmann/json.
- `data/`: el archivo FASTA.

## Cómo abrir el menú

**En CLion** (es lo que usé):
1. Open y elegir la carpeta del proyecto. Esperar que cargue CMake.
2. En Edit Configurations dejar Program arguments vacío y poner Working directory en `$ProjectFileDir$`.
3. Build y Run.

**En Code::Blocks:**
1. Crear un proyecto de consola en C++ dentro de esta carpeta y quitarle el main.cpp que trae.
2. Agregar `main.cpp`, `Menu.cpp` y todos los .cpp y .h de `estructuras/` y `puente_interfaz/`.
3. En Build options, en Search directories, agregar `estructuras`, `puente_interfaz` y `externo`.
4. Activar C++17 y darle Build and run.

El menú tiene estas opciones:
1. Resumen de la tabla de virus (tamaño, colisiones, factor de carga)
2. Buscar un virus por su id
3. K-mers de un virus y los n más repetidos
4. Ver la matriz del grafo de un virus
5. Comparar dos virus (k=3, k=6 y grafo)
0. Salir

Un id para probar: `MAC.US.x.239.M33262`

## Cómo abrir la interfaz

Lo más fácil es abrir `Genoma-Lab-0.1.0-portable.exe` (está en el Drive) con doble clic. Ya trae el programa y el archivo FASTA. Si Windows dice "Windows protegió su PC", hay que darle a Más información y luego Ejecutar de todas formas.

Desde el código:
1. Compilar primero el programa en C++ (ver arriba).
2. Tener Node.js instalado.
3. En la carpeta `interfaz/` correr `npm install` la primera vez y luego `npm run dev`.

La app busca el .exe sola en `cmake-build-debug`, `cmake-build-release`, `bin/Debug`, `bin/Release` o en la carpeta del proyecto.

## Cómo se conecta la interfaz con el C++

Si el programa se abre sin nada, sale el menú. Si se abre con `--json`, hace un solo comando y responde en JSON, y así lo usa la interfaz. Por ejemplo:

```
ProyectoGenomico.exe --json data/HIV2_ALL_2021_env_DNA.2000.fasta resumen
ProyectoGenomico.exe --json data/HIV2_ALL_2021_env_DNA.2000.fasta kmers MAC.US.x.239.M33262 3
```

La interfaz solo dibuja lo que le responde el programa. Lo único que calcula ella misma es el mapa 2D de la vista Galaxia.

## Si algo falla

- Sale "No se pudo abrir data/...": el Working directory no es la carpeta del proyecto.
- Sale JSON en vez del menú: en CLion la casilla de Program arguments tiene algo escrito, hay que dejarla vacía.
- Al abrir el .exe con doble clic falta una DLL: es por el compilador MinGW. Mejor correrlo desde CLion o Code::Blocks.