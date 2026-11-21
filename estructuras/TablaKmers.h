#ifndef TABLAKMERS_H
#define TABLAKMERS_H

#include <string>
#include <vector>
#include "MaxHeap.h"
using namespace std;

struct CasillaKmer {
    bool ocupada = false;
    string kmer;
    int conteo = 0;
};

bool esValido(const string& kmer);

class TablaKmers {
private:
    vector<CasillaKmer> casillas;
    int k;
    int distintos;
    int colisiones;
    bool usarDoble;

public:
    TablaKmers(int k, bool doble=true);
    void insertar(const string& kmer);
    int buscar(const string& kmer);
    void contarDe(const string& adn);
    void mostrar();
    int getColisiones();
    vector<ParKmer> obtenerPares();
    int getDistintos();
    int getTamano();
    const vector<CasillaKmer>& getCasillas();

};

#endif