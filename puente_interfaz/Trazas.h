// =====================================================================
//  GENERADO CON IA (Claude) — solo para la interfaz gráfica "Genoma Lab".
//  No es parte de las estructuras calificadas (esas están en estructuras/).
//
//  Una "traza" es una libreta que anota los pasos que hizo una estructura,
//  para que la interfaz pueda animarlos. Las trazas NO modifican las
//  estructuras: leen su estado con los getters (getCasillas, getDatos),
//  dejan que la estructura haga el trabajo real y anotan lo que pasó.
// =====================================================================
#ifndef TRAZAS_H
#define TRAZAS_H

#include <string>
#include <vector>
#include <utility>
#include "TablaVirus.h"
#include "TablaKmers.h"
#include "MaxHeap.h"
using namespace std;

// ----- Búsqueda en la TablaVirus (pantalla Buscar) -----
struct PasoHash {                  // cómo va creciendo h, letra por letra
    char letra;
    unsigned long long valor;      // h después de sumar esa letra
};

struct PasoBusqueda {              // una casilla que se revisó
    int pos;
    bool ocupada;
    string idEnCasilla;            // "" si estaba vacía
    bool igual;                    // ¿era el ID que buscaba?
};

struct TrazaBusqueda {             // la "película" completa de una búsqueda
    vector<PasoHash> hashPasos;
    unsigned long long hash;
    int inicio;                    // casilla donde empezó (hash % tamaño)
    vector<PasoBusqueda> pasos;
    int posFinal;                  // -1 si no lo encontró
};

TrazaBusqueda trazarBusqueda(TablaVirus& tabla, const string& id);

// ----- Inserción en la TablaKmers (pantalla K-mers) -----
struct Salto {                     // una casilla que se miró
    int pos;
    string kmerEnCasilla;          // "" si estaba vacía
    string resultado;              // "colision", "nuevo" o "sumado"
};

struct TrazaKmer {                 // la "película" de una inserción
    unsigned long long hash;
    int inicio;                    // casilla donde empezó
    int paso;                      // de cuánto en cuánto salta
    vector<Salto> saltos;
    int conteoFinal;
};

TrazaKmer trazarInsercionKmer(TablaKmers& tabla, const string& kmer, bool doble);

// ----- MaxHeap (pantalla Heap): pares de posiciones intercambiadas -----
vector<pair<int, int>> trazarInsertarHeap(MaxHeap& heap, const ParKmer& par);
vector<pair<int, int>> trazarExtraerHeap(MaxHeap& heap, ParKmer& extraido);

#endif
