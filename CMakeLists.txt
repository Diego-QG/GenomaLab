cmake_minimum_required(VERSION 4.3)
project(ProyectoGenomico)

set(CMAKE_CXX_STANDARD 20)

# ---------------------------------------------------------------
# Código del estudiante: las estructuras de datos del proyecto
# ---------------------------------------------------------------
set(ESTRUCTURAS
        estructuras/DNASequence.h
        estructuras/Fasta.h
        estructuras/Fasta.cpp
        estructuras/TablaVirus.h
        estructuras/TablaVirus.cpp
        estructuras/TablaKmers.h
        estructuras/TablaKmers.cpp
        estructuras/MaxHeap.h
        estructuras/MaxHeap.cpp
        estructuras/GrafoPares.h
        estructuras/GrafoPares.cpp
)

# ---------------------------------------------------------------
# Puente con la interfaz gráfica (modo --json)
#   Comandos.cpp    -> escrito por el estudiante
#   ComandosIA.cpp, Trazas.h/.cpp -> generados con IA
# ---------------------------------------------------------------
set(PUENTE
        puente_interfaz/Comandos.h
        puente_interfaz/Comandos.cpp
        puente_interfaz/ComandosIA.cpp
        puente_interfaz/Trazas.h
        puente_interfaz/Trazas.cpp
        estructuras/Similitud.h
        estructuras/Similitud.cpp
        Menu.cpp
)

add_executable(ProyectoGenomico main.cpp ${ESTRUCTURAS} ${PUENTE})

# Carpetas donde buscar los #include (así no hay que cambiar ningún #include)
target_include_directories(ProyectoGenomico PRIVATE estructuras puente_interfaz externo)