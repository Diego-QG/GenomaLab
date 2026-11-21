// =====================================================================
//  GENERADO CON IA (Claude) — solo para la interfaz gráfica "Genoma Lab".
//  Ver la explicación en Trazas.h
// =====================================================================
#include "Trazas.h"

// =====================================================================
// Búsqueda: repite el recorrido de TablaVirus::buscar leyendo las
// casillas (getCasillas) y anota cada paso
// =====================================================================
TrazaBusqueda trazarBusqueda(TablaVirus& tabla, const string& id) {
    TrazaBusqueda t;
    const vector<Casilla>& casillas = tabla.getCasillas();

    // 1. El hash letra por letra (mismo cálculo que hashTexto, pero anotando)
    unsigned long long h = 0;
    for (char c : id) {
        h = h * 31 + c;
        t.hashPasos.push_back({c, h});
    }
    t.hash = h;

    // 2. Casilla inicial
    int pos = h % casillas.size();
    t.inicio = pos;
    t.posFinal = -1;

    // 3. Sondeo lineal, anotando cada casilla ocupada que se revisa
    int revisados = 0;
    while (casillas[pos].ocupada && revisados < casillas.size()) {
        bool igual = (casillas[pos].virus.id == id);
        t.pasos.push_back({pos, true, casillas[pos].virus.id, igual});
        if (igual) {
            t.posFinal = pos;
            return t;
        }
        pos = (pos + 1) % casillas.size();
        revisados++;
    }

    // 4. Si se detuvo en una casilla vacía, ese es el último paso
    if (!casillas[pos].ocupada) {
        t.pasos.push_back({pos, false, "", false});
    }
    return t;
}

// =====================================================================
// Inserción de un k-mer: ANTES de insertar, recorre las casillas (solo
// lectura) con la misma fórmula de TablaKmers::insertar y anota los
// saltos; DESPUÉS deja que la tabla haga la inserción de verdad.
// =====================================================================
TrazaKmer trazarInsercionKmer(TablaKmers& tabla, const string& kmer, bool doble) {
    TrazaKmer t;
    const vector<CasillaKmer>& casillas = tabla.getCasillas();
    int tam = casillas.size();

    unsigned long long h = hashTexto(kmer);
    int pos = h % tam;
    int paso = (h / tam) % tam;
    if (!doble) paso = 1;
    if (paso % 2 == 0) paso++;

    t.hash = h;
    t.inicio = pos;
    t.paso = paso;

    while (casillas[pos].ocupada && casillas[pos].kmer != kmer) {
        t.saltos.push_back({pos, casillas[pos].kmer, "colision"});
        pos = (pos + paso) % tam;
    }
    if (casillas[pos].ocupada) {
        t.saltos.push_back({pos, casillas[pos].kmer, "sumado"});
    } else {
        t.saltos.push_back({pos, "", "nuevo"});
    }

    tabla.insertar(kmer);                       // la inserción real la hace la tabla
    t.conteoFinal = tabla.buscar(kmer);         // y se lee cómo quedó el conteo
    return t;
}

// =====================================================================
// Heap: se compara el arreglo antes y después de la operación real
// (getDatos) para saber qué posiciones se intercambiaron y en qué orden.
// Se compara por k-mer porque en un heap de k-mers no se repiten.
// =====================================================================
vector<pair<int, int>> trazarInsertarHeap(MaxHeap& heap, const ParKmer& par) {
    vector<ParKmer> antes = heap.getDatos();
    antes.push_back(par);                       // así queda justo antes de subir

    heap.insertar(par);                         // la operación real
    const vector<ParKmer>& despues = heap.getDatos();

    // subir: el nuevo sube por sus padres mientras su casilla no coincida
    vector<pair<int, int>> swaps;
    int i = antes.size() - 1;
    while (i > 0 && antes[i].kmer != despues[i].kmer) {
        int padre = (i - 1) / 2;
        swap(antes[i], antes[padre]);
        swaps.push_back({i, padre});
        i = padre;
    }
    return swaps;
}

vector<pair<int, int>> trazarExtraerHeap(MaxHeap& heap, ParKmer& extraido) {
    vector<ParKmer> antes = heap.getDatos();
    vector<pair<int, int>> swaps;

    // primer paso de extraerMax: la raíz se cambia con el último y se quita
    int ultimo = antes.size() - 1;
    swap(antes[0], antes[ultimo]);
    swaps.push_back({0, ultimo});
    antes.pop_back();

    extraido = heap.extraerMax();               // la operación real
    const vector<ParKmer>& despues = heap.getDatos();

    // bajar: en cada nivel, el hijo que subió es el que ahora está arriba
    int i = 0;
    while (i < antes.size() && antes[i].kmer != despues[i].kmer) {
        int izq = 2 * i + 1;
        int der = 2 * i + 2;
        int hijo = -1;
        if (izq < antes.size() && antes[izq].kmer == despues[i].kmer) hijo = izq;
        if (der < antes.size() && antes[der].kmer == despues[i].kmer) hijo = der;
        if (hijo == -1) break;
        swap(antes[i], antes[hijo]);
        swaps.push_back({i, hijo});
        i = hijo;
    }
    return swaps;
}
