#include <iostream>
#include <string>
#include <vector>
#include "Fasta.h"
#include "TablaVirus.h"
#include "Comandos.h"
#include "Menu.h"
using namespace std;

// Si se ejecuta sin argumentos se abre el menú de consola
// Si se ejecuta con --json responde en JSON para la interfaz gráfica, por ejemplo:
// ProyectoGenomico.exe --json data/HIV2_ALL_2021_env_DNA.2000.fasta resumen
// argv[2] es la ruta del archivo, argv[3] el comando y desde argv[4] sus datos (id, k, n...)

int main(int argc, char* argv[]) {
    json respuesta;

    // Si no se pone --json se abre el menú
    if (argc < 2 || string(argv[1]) != "--json") {
        ejecutarMenu();
        return 0;
    }

    // Si faltan argumentos se devuelve un error
    if (argc < 4) {
        respuesta["ok"] = false;
        respuesta["error"] = "Uso: ProyectoGenomico.exe --json <archivo.fasta> <comando> [argumentos]";
        cout << respuesta.dump(2) << endl;
        return 1;
    }

    // Se leen la ruta y el comando
    string ruta = argv[2];
    string archivo = ruta.substr(ruta.find_last_of("/\\") + 1);   // solo el nombre del archivo
    string comando = argv[3];

    // Se lee el archivo y se llena la tabla de virus
    vector<DNASequence> virus = leerFasta(ruta);
    if (virus.empty()) {
        respuesta["ok"] = false;
        respuesta["error"] = "No se pudo leer ningún virus de: " + ruta;
        cout << respuesta.dump(2) << endl;
        return 1;
    }

    TablaVirus tabla;
    for (int i = 0; i < virus.size(); i++) {
        tabla.insertar(virus[i]);
    }

    // Según el comando se llama a su función
    if (comando == "resumen") {
        respuesta = comandoResumen(virus, tabla, archivo);
    } else if (comando == "virus" && argc >= 5) {
        respuesta = comandoVirus(tabla, argv[4]);
    } else if (comando == "kmers" && argc >= 7) {
        respuesta = comandoKmers(tabla, argv[4], stoi(argv[5]), stoi(argv[6]));
    } else if (comando == "trazakmers" && argc >= 8) {
        respuesta = comandoTrazakmers(tabla, argv[4], stoi(argv[5]), argv[6], stoi(argv[7]));
    } else if (comando == "buscar" && argc >= 5) {
        respuesta = comandoBuscar(tabla, argv[4]);
    } else if (comando == "grafo" && argc >= 5) {
        int limiteArcos = 8;                        // por defecto 8 parejas
        if (argc >= 6) limiteArcos = stoi(argv[5]);
        respuesta = comandoGrafo(tabla, argv[4], limiteArcos);
    } else if (comando == "experimento") {
        respuesta = comandoExperimento(virus);
    } else if (comando == "heap" && argc >= 7) {
        respuesta = comandoHeap(tabla, argv[4], stoi(argv[5]), stoi(argv[6]));
    } else if (comando == "comparar" && argc >= 6) {
        respuesta = comandoComparar(tabla, argv[4], argv[5]);
    } else {
        respuesta["ok"] = false;
        respuesta["error"] = "Comando desconocido o faltan argumentos: " + comando;
    }

    // Se imprime la respuesta en JSON
    cout << respuesta.dump(2) << endl;







// int main() {
    // vector<DNASequence> virus = leerFasta("data/HIV2_ALL_2021_env_DNA.2000.fasta");
    //
    // TablaVirus tabla;
    // for (int i = 0; i < virus.size(); i++) {
    //     tabla.insertar(virus[i]);
    // }
    // tabla.mostrar();
    //
    // cout << '\n' << tabla.getTamano() << endl;
    //
    // cout << "Buscar SMM.US.x.SME543.U72748: " << tabla.buscar("SMM.US.x.SME543.U72748") << "\n";
    // cout << "Buscar HOLA: " << tabla.buscar("HOLA") << "\n";

    // TablaKmers huella(3);
    // huella.contarDe(virus[0].sequence);
    // vector<ParKmer> lista = huella.obtenerPares();
    // MaxHeap maxHeap;
    // huella.mostrar();
    //
    // for (int i = 0; i < lista.size(); i++) {
    //     maxHeap.insertar(lista[i]);
    // }
    //
    // for (int j = 0; j<5; j++) {
    //     ParKmer actual = maxHeap.extraerMax();
    //     cout << actual.kmer << " : " << actual.conteo << endl;
    // }
    //
    //
    // cout << "ATG: " << huella.buscar("ATG") << endl;
    // cout << "AAA: " << huella.buscar("AAA") << endl;

    // MaxHeap maxHeap;
    // maxHeap.insertar({"AAA", 70});
    // maxHeap.insertar({"ATG", 64});
    // maxHeap.insertar({"CAA", 78});
    // maxHeap.insertar({"TCG", 8});
    // maxHeap.insertar({"GAT", 48});
    // while (!maxHeap.vacio()) {
    //     ParKmer actual = maxHeap.extraerMax();
    //     cout << actual.kmer << " : " << actual.conteo << endl;
    // }

    // string V1 = "ATGCATGC";
    // GrafoPares gr = GrafoPares();
    // gr.construirDe(V1);
    // gr.mostrar();
//
//     return 0;
// }

// string grupoDe(const string& id) {
//     return id.substr(0, id.find('.'));
// }
//
// double calcularGC(const string& adn) {
//     int atgc = 0;
//     int gc = 0;
//     for (int i=0; i<adn.size(); i++) {
//         if (adn[i] == 'A' || adn[i] == 'T') atgc++;
//         if (adn[i] == 'G' || adn[i] == 'C'){
//             gc++;
//             atgc++;
//         }
//     }
//     if (atgc == 0) return 0.0;
//     double porcentaje = 100.0 * gc / atgc;
//     return round(porcentaje * 100) / 100;
// }
//
// int contarAmbiguas(const string& adn) {
//     int natgc = 0;
//     for (int i=0; i<adn.size(); i++) {
//         if (adn[i] == 'A' || adn[i] == 'T' || adn[i] == 'G' || adn[i] == 'C') {
//             continue;
//         }else {
//             natgc++;
//         }
//     }
//     return natgc;
// }
//
// int main(int argc, char* argv[]) {
//
//     string ruta = argv[2];
//     string archivo = ruta.substr(ruta.find_last_of("/\\") + 1);
//     string comando = argv[3];
//
//     vector<DNASequence> virus = leerFasta(ruta);
//
//     TablaVirus tabla;
//     for (int i = 0; i < virus.size(); i++) {
//         tabla.insertar(virus[i]);
//     }
//
//     json respuesta;
//
//     if (comando == "resumen") {
//         respuesta["ok"] = true;
//         respuesta["total"] = virus.size();
//         respuesta["virus"] = json::array();             // una lista vacía
//
//         for (int i = 0; i < virus.size(); i++) {
//             json v;                                     // un formulario nuevo
//             v["id"] = virus[i].id;
//             v["longitud"] = virus[i].sequence.size();
//             v["grupo"] = grupoDe(virus[i].id);
//             v["gc"] = calcularGC(virus[i].sequence);
//             v["ambiguas"] = contarAmbiguas(virus[i].sequence);
//             respuesta["virus"].push_back(v);            // lo meto a la lista
//
//
//         }
//         json t;
//         t["tamano"] = tabla.getTamano();
//         t["cantidad"] = tabla.getCantidad();
//         t["colisiones"] = tabla.getColisiones();
//         t["factorCarga"] = tabla.getFactorCarga();
//         respuesta["tabla"] = t;
//         respuesta["archivo"] = archivo;
//     }else if (comando == "virus") {
//         string id = argv[4];
//         int pos = tabla.buscar(id);
//         if (pos == -1) {
//             respuesta["ok"] = false;
//             respuesta["error"] = "No existe el virus: " + id;
//         }else {
//             DNASequence v = tabla.obtener(pos);
//             respuesta["ok"] = true;
//             respuesta["id"] = id;
//             respuesta["grupo"] = grupoDe(v.id);
//             respuesta["longitud"] = v.sequence.size();
//             respuesta["gc"] = calcularGC(v.sequence);
//             respuesta["secuencia"] = v.sequence;
//         }
//     } else if (comando == "kmers") {
//         string id = argv[4];
//         int k = stoi(argv[5]);     // "3" → 3
//         int pos = tabla.buscar(id);
//         if (pos == -1) {
//             respuesta["ok"] = false;
//             respuesta["error"] = "No existe el virus: " + id;
//         }else {
//             TablaKmers huella(k);
//             huella.contarDe(tabla.obtener(pos).sequence);
//             respuesta["ok"] = true;
//             respuesta["id"] = id;
//             respuesta["distintos"] = huella.getDistintos();
//             respuesta["colisiones"] = huella.getColisiones();
//             respuesta["top"] = huella.getTop(); //sé que no existe
//
//         }
//
//     }else {
//         respuesta["ok"] = false;
//         respuesta["error"] = "Comando desconocido: " + comando;
//
//     }
//
//     cout << respuesta.dump(2) << endl;               // lo convierte a texto

    return 0;
}