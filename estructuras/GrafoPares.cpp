#include "GrafoPares.h"
#include <iostream>
#include <iomanip>
using namespace std;

// Cambia cada letra por un número: A=0, C=1, G=2, T=3
// si es otra letra (N, R, etc.) devuelve -1
int valorLetra(char c) {
    if (c == 'A') return 0;
    if (c == 'C') return 1;
    if (c == 'G') return 2;
    if (c == 'T') return 3;
    return -1;
}

// Saca la fila/columna de una pareja, como si fuera un número en base 4
// por ejemplo CG = 1*4 + 2 = 6
int indicePareja(char a, char b) {
    int valA = valorLetra(a);
    int valB = valorLetra(b);
    if (valA>=0 && valB>=0) return valA*4 + valB;
    return -1;      // si alguna letra no es ACGT, la pareja no cuenta
}

// Empiezo con la matriz de 16x16 toda en 0
GrafoPares::GrafoPares() {
    for (int i = 0; i < 16; i++) {
        for (int j = 0; j < 16; j++) {
            matriz[i][j] = 0;
        }
    }
}

void GrafoPares::construirDe(const string& adn) {
    vector<int> pares;

    // corto el ADN en parejas sin que se repitan letras (de 2 en 2)
    // ATGCAT -> AT, GC, AT
    for (int i=0; i+1<adn.size(); i+=2) {
        pares.push_back(indicePareja(adn[i], adn[i+1]));
    }

    // uno cada pareja con todas las que vienen después
    // mientras más lejos estén, menos peso: 1 / distancia
    // si el arco ya existía, se suma
    for (int a=0; a<pares.size(); a++) {
        for (int b=a+1; b<pares.size(); b++) {
            if (pares[a] >= 0 && pares[b] >= 0) {
                matriz[pares[a]][pares[b]] += (1.0)/(b-a);
            }
        }
    }
}

// Devuelve el peso del arco de la pareja i a la pareja j
double GrafoPares::getPeso(int i, int j) {
    return matriz[i][j];
}

// Imprime la matriz con los nombres de las parejas (AA, AC, ... TT)
void GrafoPares::mostrar() {
    cout << fixed << setprecision(2);
    string letras = "ACGT";
    string nombre = "  ";
    string nombreFila = "  ";

    // primera fila con los nombres de las columnas
    cout << setw(4) << "";
    for (int i=0; i<16; i++) {
        nombre[0] = letras[i/4];     // primera letra
        nombre[1] = letras[i%4];     // segunda letra
        cout << setw(6) << nombre;
    }
    cout << endl;

    // cada fila: su nombre y luego los 16 pesos
    for (int i=0; i<16; i++) {
        nombreFila[0] =  letras[i/4];
        nombreFila[1] = letras[i%4];
        cout << setw(4) << nombreFila;
        for (int j=0; j<16; j++) {
            cout << setw(6) << getPeso(i, j);
        }
        cout << endl;
    }
}