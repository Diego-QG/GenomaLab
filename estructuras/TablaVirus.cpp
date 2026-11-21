#include "TablaVirus.h"
#include <iostream>

// Convierte un texto en un número grande (hash polinomial con base 31)
// si se pasa del límite da la vuelta sola, no importa
unsigned long long hashTexto(const string& texto) {
    unsigned long long h = 0;
    for (char c : texto) {
        h = h * 31 + c;
    }
    return h;
}

// Reviso divisores solo hasta la raíz de n
bool esPrimo(int n) {
    if (n<2) return false;
    for (int d=2; d*d<=n; d++) {
        if (n%d==0) return false;
    }
    return true;
}

// Busco el primer primo desde n para arriba
int siguientePrimo(int n) {
    while (!esPrimo(n)) n++;
    return n;
}

// Empiezo con 10 casillas vacías
TablaVirus::TablaVirus() {
    casillas.resize(10);
    cantidad = 0;
    colisiones = 0;
}

void TablaVirus::insertar(const DNASequence& v) {
    // si al meter este virus se pasa de la mitad, agrando la tabla primero
    if ((double)(cantidad + 1) / casillas.size() > 0.5) {
        redimensionar();
    }
    int pos = hashTexto(v.id) % casillas.size();
    // sondeo lineal: si está ocupada paso a la siguiente
    while (casillas[pos].ocupada) {
        colisiones++;
        pos = (pos + 1) % casillas.size();
    }
    casillas[pos].ocupada = true;
    casillas[pos].virus = v;
    cantidad++;
}

// Devuelve la posición donde está el virus, o -1 si no está
int TablaVirus::buscar(const string& id) {
    int pos = hashTexto(id) % casillas.size();
    int revisados = 0;

    // camino igual que en insertar hasta encontrarlo o llegar a una vacía
    while (casillas[pos].ocupada && revisados < casillas.size()) {
        if (casillas[pos].virus.id == id) {
            return pos;
        }
        pos = (pos + 1) % casillas.size();
        revisados++;
    }
    return -1;
}

// Imprime todas las casillas, las vacías salen solo con su número
void TablaVirus::mostrar() {
    for (int i=0; i<casillas.size(); i++) {
        cout << '[' << i << ']';
        if (casillas[i].ocupada) cout << casillas[i].virus.id;
        cout << endl;
    }
    cout << "Cantidad de virus: " << cantidad << endl;
    cout << "Cantidad de colisiones: " << colisiones << endl;
}

int TablaVirus::getColisiones() {
    return colisiones;
}

int TablaVirus::getTamano() {
    return casillas.size();
}

int TablaVirus::getCantidad() {
    return cantidad;
}

// Qué tan llena está: virus / casillas
double TablaVirus::getFactorCarga() {
    return (double)cantidad/getTamano();
}

DNASequence TablaVirus::obtener(int pos) {
    return casillas[pos].virus;
}

// Agranda la tabla al siguiente primo del doble y vuelve a meter todo
void TablaVirus::redimensionar() {
    vector<Casilla> viejas = casillas;              // guardo una copia de lo que había
    int nuevoTam = siguientePrimo(casillas.size()*2);
    casillas.assign(nuevoTam,Casilla());            // tabla nueva toda vacía
    // anoto el cambio para mostrarlo en la interfaz (de, a, en qué virus pasó)
    historial.push_back({(int)viejas.size(), nuevoTam, cantidad + 1});
    cantidad = 0;
    // rehash: cada virus cae en otra posición porque cambió el tamaño
    for (int i=0; i<viejas.size(); i++) {
        if (viejas[i].ocupada) {
            insertar(viejas[i].virus);
        }
    }
}

const vector<Redimension>& TablaVirus::getRedimensiones() { return historial; }

const vector<Casilla>& TablaVirus::getCasillas() { return casillas; }