#ifndef COMANDOS_H
#define COMANDOS_H

#include <string>
#include <vector>
#include "json.hpp"
#include "DNASequence.h"
#include "TablaVirus.h"
using namespace std;
using json = nlohmann::ordered_json;

// Ayudantes
string grupoDe(const string& id);            // Saca la familia del virus, el que está antes del primer punto "MAC.US.x.239..." -> "MAC"
double calcularGC(const string& adn);        // Porcentaje de G y C sobre lo válido, sirve para comparar entre los demás virus para confirmar si son familia
int contarAmbiguas(const string& adn);       // Cuántas letras no son A, C, G, T

// ----- Escritos por el estudiante (Comandos.cpp) -----
json comandoResumen(const vector<DNASequence>& virus, TablaVirus& tabla, const string& archivo);
json comandoVirus(TablaVirus& tabla, const string& id);
json comandoKmers(TablaVirus& tabla, const string& id, int k, int n);

// ----- Generados con IA para la interfaz (ComandosIA.cpp) -----
json comandoTrazakmers(TablaVirus& tabla, const string& id, int k, const string& metodo, int limite);
json comandoBuscar(TablaVirus& tabla, const string& id);
json comandoGrafo(TablaVirus& tabla, const string& id, int limiteArcos);
json comandoExperimento(const vector<DNASequence>& virus);
json comandoHeap(TablaVirus& tabla, const string& id, int k, int n);
json comandoComparar(TablaVirus& tabla, const string& id1, const string& id2);

#endif