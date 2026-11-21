#ifndef MAXHEAP_H
#define MAXHEAP_H

#include <string>
#include <vector>
using namespace std;

struct ParKmer {
    string kmer;
    int conteo;
};

class MaxHeap {
private:
    vector<ParKmer> datos;
    void subir(int i);
    void bajar(int i);
public:
    void insertar(const ParKmer& p);
    ParKmer extraerMax();
    bool vacio();
    int tamano();
    const vector<ParKmer>& getDatos();
};

#endif