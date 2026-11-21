#include "Similitud.h"
#include "TablaKmers.h"
#include <cmath>

// Compara dos virus por sus k-mers con la similitud coseno
// 1 = casi iguales, 0 = nada que ver
double similitudKmers(const string& adn1, const string& adn2, int k) {
    // cuento los k-mers de cada virus en su propia tabla
    TablaKmers tabla1(k);
    tabla1.contarDe(adn1);
    TablaKmers tabla2(k);
    tabla2.contarDe(adn2);
    vector<ParKmer> lista1 = tabla1.obtenerPares();
    vector<ParKmer> lista2 = tabla2.obtenerPares();
    double punto = 0;
    double norma1 = 0;
    double norma2 = 0;

    // por cada k-mer del virus 1 busco cuántas veces sale en el virus 2
    // si no sale, buscar da 0 y no suma nada al producto punto
    for (int i = 0; i < lista1.size(); i++) {
        int V1 = lista1[i].conteo;
        int V2 = tabla2.buscar(lista1[i].kmer);
        punto += V1*V2;
        norma1 += (V1*V1);
    }
    // la norma del virus 2 va aparte porque tiene k-mers que el 1 no tiene
    for (int i = 0; i < lista2.size(); i++) {
        int V2 = lista2[i].conteo;
        norma2 += (V2*V2);
    }
    // para no dividir entre 0 si alguna secuencia está vacía
    if (norma1 == 0 || norma2 == 0) {
        return 0;
    }
    return punto / (sqrt(norma1) * sqrt(norma2));
}

// Lo mismo pero con los pesos de las dos matrices de 16x16
double similitudGrafo(GrafoPares& g1, GrafoPares& g2) {
    double x = 0;
    double y = 0;
    double punto = 0;
    double norma1 = 0;
    double norma2 = 0;
    // recorro las 256 casillas y voy sumando todo en una sola pasada
    for (int i = 0; i<16; i++) {
        for (int j = 0; j<16; j++) {
            x = g1.getPeso(i, j);
            y = g2.getPeso(i, j);
            punto += x*y;
            norma1 += x*x;
            norma2 += y*y;
        }
    }
    if (norma1 == 0 || norma2 == 0) {
        return 0;
    }
    return punto / (sqrt(norma1) * sqrt(norma2));
}