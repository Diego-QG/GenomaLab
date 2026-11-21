#ifndef TABLAVIRUS_H
#define TABLAVIRUS_H

#include <string>
#include <vector>
#include "DNASequence.h"
using namespace std;

unsigned long long hashTexto(const string& texto);
bool esPrimo(int n);
int siguientePrimo(int n);

struct Casilla {
    bool ocupada = false;
    DNASequence virus;
};

struct Redimension {
    int de;                                 // Tamaño antes
    int a;                                  // Tamaño después
    int enInsercion;                        // Qué número de virus provocó el crecimiento
};

class TablaVirus {
private:
    vector<Casilla> casillas;
    int cantidad;
    int colisiones;
    void redimensionar();
    vector<Redimension> historial;

public:
    TablaVirus();
    void insertar(const DNASequence& v);
    int buscar(const string& id);
    void mostrar();
    int getColisiones();
    int getTamano();
    int getCantidad();
    double getFactorCarga();
    DNASequence obtener(int pos);
    const vector<Redimension>& getRedimensiones();
    const vector<Casilla>& getCasillas();
};

#endif