// Comandos del modo --json que hice yo
// (los que se hicieron con IA están en ComandosIA.cpp)
#include "Comandos.h"
#include <cmath>
#include "TablaKmers.h"
#include "MaxHeap.h"



// ---------- Funciones de apoyo ----------

// El grupo es lo que está antes del primer punto del id (ej: A1, B, SMM)
string grupoDe(const string& id) {
    return id.substr(0, id.find('.'));
}

// Porcentaje de G y C, contando solo las letras ACGT
double calcularGC(const string& adn) {
    int atgc = 0;
    int gc = 0;
    for (int i = 0; i < adn.size(); i++) {
        if (adn[i] == 'A' || adn[i] == 'T') atgc++;
        if (adn[i] == 'G' || adn[i] == 'C') {
            gc++;
            atgc++;
        }
    }
    if (atgc == 0) return 0.0;
    double porcentaje = 100.0 * gc / atgc;
    return round(porcentaje * 100) / 100;      // 2 decimales
}

// Cuenta las letras que no son ACGT (N, R, Y...)
int contarAmbiguas(const string& adn) {
    int natgc = 0;
    for (int i = 0; i < adn.size(); i++) {
        if (adn[i] == 'A' || adn[i] == 'T' || adn[i] == 'G' || adn[i] == 'C') {
            continue;
        } else {
            natgc++;
        }
    }
    return natgc;
}




// ---------- resumen: lista de todos los virus y datos de la tabla ----------
json comandoResumen(const vector<DNASequence>& virus, TablaVirus& tabla, const string& archivo) {
    json respuesta;
    respuesta["ok"] = true;                                  // Todo bien
    respuesta["archivo"] = archivo;                          // Nombre del archivo fasta
    respuesta["total"] = virus.size();                       // Cantidad total de virus
    respuesta["virus"] = json::array();                         // Una lista vacía

    for (int i = 0; i < virus.size(); i++) {
        json v;                                                 // Un formulario nuevo
        v["id"] = virus[i].id;                               // El id del virus
        v["longitud"] = virus[i].sequence.size();            // La longitud de la secuencia
        v["grupo"] = grupoDe(virus[i].id);                   // El grupo al que pertenece el virus
        v["gc"] = calcularGC(virus[i].sequence);             // Su porcentaje de GC del virus
        v["ambiguas"] = contarAmbiguas(virus[i].sequence);   // Cantidad de no ACGT
        respuesta["virus"].push_back(v);                        // Lo meto a la lista
    }

    json t;
    t["tamano"] = tabla.getTamano();                         // Cantidad de casillas de la tabla de los virus (número primo)
    t["cantidad"] = tabla.getCantidad();                     // Cantidad de virus metidos
    t["colisiones"] = tabla.getColisiones();                 // Colisiones que hubo al momento de estar metiendo los virus a la tabla
    t["factorCarga"] = tabla.getFactorCarga();               // Qué tan llena está la tabla de los virus

    // Cada vez que la tabla creció: de qué tamaño a qué tamaño y en qué virus pasó
    t["redimensiones"] = json::array();
    const vector<Redimension>& redimensiones = tabla.getRedimensiones();
    for (int i=0; i<redimensiones.size(); i++) {
        json r;
        r["de"] = redimensiones[i].de;
        r["a"] = redimensiones[i].a;
        r["enInsercion"] = redimensiones[i].enInsercion;
        t["redimensiones"].push_back(r);
    }

    // Solo mando las casillas ocupadas con su posición, para dibujar la tabla
    t["ocupadas"] = json::array();
    const vector<Casilla>& casi = tabla.getCasillas();
    for (int i=0; i<casi.size(); i++) {
        if (casi[i].ocupada) {
            json c;
            c["pos"] = i;
            c["id"] = casi[i].virus.id;
            t["ocupadas"].push_back(c);
        }
    }

    respuesta["tabla"] = t;                                   // Se mete la lista t a la etiqueta tabla

    return respuesta;
}




// ---------- virus <id>: un virus completo, buscado con la tabla de virus ----------
json comandoVirus(TablaVirus& tabla, const string& id) {
    json respuesta;

    int pos = tabla.buscar(id);                                                             // Busca la posición en la tabla del virus en base al id
    if (pos == -1) {                                                                        // En caso de que no se encuentre da -1
        respuesta["ok"] = false;                                                         // Se pone que no está bien
        respuesta["error"] = "No existe el virus: " + id;                                // Se informa que no existe el virus y ahí se pega el ID
        return respuesta;
    }

    DNASequence v = tabla.obtener(pos);                                                     // Se saca el virus de la posición que encontró la búsqueda
    respuesta["ok"] = true;                                                              // Se dice que todo bien
    respuesta["id"] = v.id;                                                              // Se copia el id del virus en su campo
    respuesta["grupo"] = grupoDe(v.id);                                                  // También se copia a qué grupo pertenece ese virus
    respuesta["longitud"] = v.sequence.size();                                           // Se calcula la longitud que tiene su secuencia
    respuesta["gc"] = calcularGC(v.sequence);                                            // Se mira el porcentaje de GC que tiene el virus
    respuesta["secuencia"] = v.sequence;                                                 // Se copia también la secuencia del virus

    // Guardo dónde está cada letra rara para que la interfaz la pinte
    respuesta["ambiguas"] = json::array();
    for (int i = 0; i < v.sequence.size(); i++) {
        char letra = v.sequence[i];
        if (letra != 'A' && letra != 'C' && letra != 'G' && letra != 'T') {
            json a;
            a["pos"] = i;
            a["letra"] = string(1, letra);
            respuesta["ambiguas"].push_back(a);
        }
    }

    return respuesta;
}




// ---------- kmers <id> <k> <n>: cuenta los k-mers y saca el top n con el heap ----------
json comandoKmers(TablaVirus& tabla, const string& id, int k, int n) {
    json respuesta;


    // Encontrar el virus con la tabla de virus
    int pos = tabla.buscar(id);
    if (pos == -1) {
        respuesta["ok"] = false;
        respuesta["error"] = "No existe el virus: " + id;
        return respuesta;
    }
    string adn = tabla.obtener(pos).sequence;                           // la secuencia de ese virus


    // Contar sus k-mers con doble hashing (la tabla principal)
    TablaKmers tablaDoble(k);                                           // 4^k casillas, vacía
    tablaDoble.contarDe(adn);                                           // Ventanita: cuenta cada k-mer
    TablaKmers tablaLineal(k, false);                              // Tabla lineal, solo para comparar colisiones
    tablaLineal.contarDe(adn);

    respuesta["ok"] = true;
    respuesta["id"] = id;
    respuesta["k"] = k;
    respuesta["distintos"] = tablaDoble.getDistintos();               // Cuántos k-mers diferentes
    respuesta["colisiones"]["doble"] = tablaDoble.getColisiones();
    respuesta["colisiones"]["lineal"] = tablaLineal.getColisiones();


    // Top n con el MaxHeap
    vector<ParKmer> lista = tablaDoble.obtenerPares();                    // Los k-mers en fila, sin huecos
    MaxHeap maxHeap;
    for (int i = 0; i < lista.size(); i++) {
        maxHeap.insertar(lista[i]);                                       // El heap los acomoda solo
    }

    respuesta["top"] = json::array();
    for (int i = 0; i < n && !maxHeap.vacio(); i++) {
        ParKmer mayor = maxHeap.extraerMax();                             // El más repetido que queda
        json p;
        p["kmer"] = mayor.kmer;
        p["conteo"] = mayor.conteo;
        respuesta["top"].push_back(p);
    }


    respuesta["tamanoTabla"] = tablaDoble.getTamano();
    // Ventanas = cuántos pedazos de tamaño k hay en el ADN
    int ventanas = adn.size() - k + 1;
    respuesta["ventanas"] = ventanas;
    // Las descartadas son las ventanas que no se contaron por tener letras raras
    int descartadas = ventanas;
    for (int i = 0; i < lista.size(); i++) {
        descartadas -= lista[i].conteo;

    }
    respuesta["descartadas"] = descartadas;

    // Las casillas ocupadas de la tabla, para dibujarlas en la interfaz
    respuesta["casillas"] = json::array();
    const vector<CasillaKmer>& cas = tablaDoble.getCasillas();
    for (int i = 0; i < cas.size(); i++) {
        if (cas[i].ocupada) {
            json c;
            c["pos"] = i;
            c["kmer"] = cas[i].kmer;
            c["conteo"] = cas[i].conteo;
            respuesta["casillas"].push_back(c);
        }
    }

    return respuesta;
}