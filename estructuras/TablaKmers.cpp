#include "TablaKmers.h"
#include "TablaVirus.h"
#include <iostream>

// doble = true usa doble hashing, false usa sondeo lineal (para comparar)
TablaKmers::TablaKmers(int k, bool doble) {
    this->k = k;
    distintos = 0;
    usarDoble = doble;
    colisiones = 0;
    // el tamaño es 4^k porque son todos los k-mers posibles con ACGT
    int tamano = 1;
    for (int i=0; i<this->k; i++) {
        tamano = tamano * 4;
    }
    casillas.resize(tamano);
}

void TablaKmers::insertar(const string &kmer) {
    unsigned long long h = hashTexto(kmer);
    int pos = h % casillas.size();                          // primera casilla
    int paso = (h / casillas.size()) % casillas.size();     // segundo hash: cuánto salto
    if (!usarDoble) paso = 1;                               // en lineal salto de 1 en 1
    // el tamaño es potencia de 2, así que si el paso es impar recorro todas las casillas
    if (paso%2==0) {paso++;}

    // salto mientras la casilla esté ocupada por otro k-mer
    while (casillas[pos].ocupada && casillas[pos].kmer != kmer) {
        colisiones++;
        pos = (pos + paso) % casillas.size();
    }
    if (casillas[pos].ocupada) {
        casillas[pos].conteo++;     // ya estaba, solo le sumo 1
    }else {
        // es nuevo, lo guardo en esta casilla
        casillas[pos].kmer = kmer;
        casillas[pos].ocupada = true;
        casillas[pos].conteo++;
        distintos++;
    }
}

// Un k-mer solo vale si tiene puras letras A, C, G, T
bool esValido(const string& kmer) {
    for (char c : kmer) {
        if (c != 'A' && c != 'C' && c != 'G' && c != 'T') {
            return false;
        }
    }
    return true;
}

// Recorro el ADN con una ventana de tamaño k que avanza de 1 en 1
// ATGCA con k=3 -> ATG, TGC, GCA
void TablaKmers::contarDe(const string &adn) {
    for (int i=0; i+k<=adn.size(); i++) {
        string pedazo = adn.substr(i, k);
        if (esValido(pedazo)) {     // los que tienen N u otra letra los boto
            insertar(pedazo);
        }
    }
}

// Devuelve cuántas veces sale el k-mer, o 0 si no está
// hace los mismos saltos que insertar para encontrarlo
int TablaKmers::buscar(const string &kmer) {
    unsigned long long h = hashTexto(kmer);
    int pos = h % casillas.size();
    int revisados = 0;
    int paso = (h / casillas.size()) % casillas.size();
    if (!usarDoble) paso = 1;
    if (paso%2==0) {
        paso++;
    }

    // si llego a una casilla vacía es que no está
    // revisados es para no quedarme dando vueltas si la tabla está llena
    while (casillas[pos].ocupada && revisados < casillas.size()) {
        if (casillas[pos].kmer == kmer) {
            return casillas[pos].conteo;
        }
        pos = (pos + paso) % casillas.size();
        revisados++;
    }
    return 0;
}

// Imprime las casillas ocupadas con su k-mer y conteo
void TablaKmers::mostrar() {
    for (int i=0; i<casillas.size(); i++) {
        if (casillas[i].ocupada) cout << "[" << i << "] " << casillas[i].kmer << ": " << casillas[i].conteo << endl;
    }
    cout << "Cantidad de kmers: " << distintos << endl;
    cout << "Cantidad de colisiones: " << colisiones << endl;
}

// Paso los k-mers de la tabla a una lista (para el heap y la similitud)
vector<ParKmer> TablaKmers::obtenerPares() {
    vector<ParKmer> pares;
    ParKmer actual;
    for (int i=0; i<casillas.size(); i++) {
        if (casillas[i].ocupada) {
            actual.conteo = casillas[i].conteo;
            actual.kmer = casillas[i].kmer;
            pares.push_back(actual);
        }
    }
    return pares;
}

int TablaKmers::getColisiones() {
    return colisiones;
}

int TablaKmers::getDistintos() {
    return distintos;
}

int TablaKmers::getTamano() {
    return casillas.size();
}

// Lo usa la interfaz para dibujar las casillas
const vector<CasillaKmer> &TablaKmers::getCasillas() {
    return casillas;
}