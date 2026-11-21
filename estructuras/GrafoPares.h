#ifndef GRAFOPARES_H
#define GRAFOPARES_H

#include <string>
#include <vector>
using namespace std;

int valorLetra(char c);
int indicePareja(char a, char b);

class GrafoPares {
private:
    double matriz[16][16];

public:
    GrafoPares();
    void construirDe(const string& adn);
    void mostrar();
    double getPeso(int i, int j);
};

#endif
