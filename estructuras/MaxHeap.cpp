#include "MaxHeap.h"

// true si el heap no tiene nada
bool MaxHeap::vacio() {
    return datos.empty();
}

int MaxHeap::tamano() {
    return datos.size();
}

// Sube el elemento mientras sea mayor que su padre
// el padre de i está en (i-1)/2
void MaxHeap::subir(int i) {
    int padre = (i-1)/2;
    while (i > 0 && datos[i].conteo > datos[padre].conteo) {
        swap(datos[i],datos[padre]);    // lo cambio con su padre
        i = padre;                      // y sigo desde arriba
        padre = (i-1)/2;
    }
}

// Baja el elemento mientras alguno de sus hijos sea mayor
// los hijos de i están en 2i+1 y 2i+2
void MaxHeap::bajar(int i) {
    int mayor = i;
    while (true) {
        int izq = (i*2)+1;
        int der = (i*2)+2;
        // veo cuál es el mayor entre el padre y sus dos hijos
        if (izq < datos.size() && datos[izq].conteo > datos[mayor].conteo) {
            mayor = izq;
        }
        if (der < datos.size() && datos[der].conteo > datos[mayor].conteo) {
            mayor = der;
        }
        if (mayor != i) {
            swap(datos[i],datos[mayor]);    // lo cambio con el hijo mayor
            i = mayor;                      // y sigo bajando
        }else {
            return;     // ya está en su sitio
        }
    }

}

// Lo meto al final y lo subo hasta donde le toca
void MaxHeap::insertar(const ParKmer &p) {
    datos.push_back(p);
    subir((datos.size() - 1));
}

// Saca el k-mer con más conteo (siempre está en la posición 0)
ParKmer MaxHeap::extraerMax() {
    ParKmer max = datos[0];
    // pongo el último arriba, borro el final y lo bajo para acomodar
    swap(datos[0], datos[datos.size()-1]);
    datos.pop_back();
    if (!vacio()) {
        bajar(0);
    }
    return max;
}

// Devuelve el vector tal cual está (lo usa la interfaz para dibujar el árbol)
const vector<ParKmer>& MaxHeap::getDatos() {
    return datos;
}