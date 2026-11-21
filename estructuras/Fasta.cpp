#include "Fasta.h"
#include <iostream>
#include <fstream>

// Lee el archivo FASTA y devuelve todos los virus en una lista
vector<DNASequence> leerFasta(const string& ruta) {
    ifstream archivo(ruta);
    bool comenzamos = false;          // para saber si ya leí el primer virus
    vector<DNASequence> lista;

    // si no abre el archivo, devuelvo la lista vacía
    if (!archivo) {
        cerr << "No se pudo abrir: " << ruta << "\n";
        return lista;
    }

    string linea;
    DNASequence actual;               // el virus que estoy armando

    while (getline(archivo, linea)) {
        // le quito el \r que deja Windows al final
        if (!linea.empty() && linea.back()=='\r') {
            linea.pop_back();
        }
        // las líneas vacías me las salto
        if (linea.empty()) {
            continue;
        }

        if (linea[0] == '>') {
            // empieza otro virus, entonces guardo el anterior
            if (comenzamos) {
                lista.push_back(actual);
            }
            comenzamos = true;
            actual.id = linea.substr(1);     // el id sin el >
            actual.sequence = "";            // empiezo su secuencia vacía

        } else {
            // es parte del ADN, la pego a la secuencia
            actual.sequence += linea;
        }
    }

    // el último virus no tiene otro > después, así que lo guardo aquí
    if (comenzamos) {
        lista.push_back(actual);
    }
    return lista;
}