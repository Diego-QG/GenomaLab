#include "Menu.h"
#include <iostream>
#include <iomanip>
#include <string>
#include <vector>
#include "Fasta.h"
#include "TablaVirus.h"
#include "TablaKmers.h"
#include "MaxHeap.h"
#include "GrafoPares.h"
#include "Similitud.h"
using namespace std;

// Imprime una línea para separar
void linea() {
    cout << "------------------------------------------------------------\n";
}

// Imprime el título de cada opción entre dos líneas
void titulo(const string& texto) {
    cout << "\n";
    linea();
    cout << "  " << texto << "\n";
    linea();
}

// Muestra las opciones del menú
void mostrarOpciones() {
    cout << "\n============================================================\n";
    cout << "        ANALISIS GENOMICO - MENU PRINCIPAL\n";
    cout << "============================================================\n";
    cout << "  1. Resumen de la tabla de virus\n";
    cout << "  2. Buscar un virus por su ID\n";
    cout << "  3. Contar k-mers y ver los n mas frecuentes\n";
    cout << "  4. Ver el grafo (matriz de adyacencia) de un virus\n";
    cout << "  5. Comparar dos virus (similitud coseno)\n";
    cout << "  0. Salir\n";
    cout << "------------------------------------------------------------\n";
    cout << "Elige una opcion:  ";
}

// Lee el número que escribe el usuario, si pone letras se limpia y devuelve -1
int leerNumero() {
    int n;
    if (!(cin >> n)) {
        cin.clear();
        string basura;
        cin >> basura;
        return -1;
    }
    return n;
}

// Pide el ID, lo busca en la tabla y devuelve su posición, si no está devuelve -1
int pedirVirus(TablaVirus& tabla, const string& mensaje) {
    string id;
    cout << mensaje;
    cin >> id;
    int pos = tabla.buscar(id);
    if (pos == -1) {
        cout << "  >> No existe ningun virus con el ID: " << id << "\n";
    }
    return pos;
}

void ejecutarMenu() {
    // Se lee el archivo y se guardan todos los virus
    vector<DNASequence> fasta = leerFasta("data/HIV2_ALL_2021_env_DNA.2000.fasta");
    if (fasta.size() == 0) {
        cerr << "No se cargo ninguna cadena de ADN\n";
        return;
    }
    // Se llena la tabla hash con los virus
    TablaVirus tablaVirus;
    for (int i = 0; i < fasta.size(); i++) {
        tablaVirus.insertar(fasta[i]);
    }
    cout << "Se cargaron " << fasta.size() << " virus del archivo.\n";
    cout << "Ejemplos de ID: " << fasta[0].id << ", " << fasta[1].id << "\n";

    // Se repite hasta que el usuario elija 0
    int seleccion = -1;
    while (seleccion != 0) {
        mostrarOpciones();
        seleccion = leerNumero();

        if (seleccion == 1) {
            // Se muestran los datos de la tabla de virus
            titulo("RESUMEN DE LA TABLA HASH DE VIRUS (sondeo lineal)");
            cout << "  Virus guardados : " << tablaVirus.getCantidad() << "\n";
            cout << "  Tamano (casillas): " << tablaVirus.getTamano() << "\n";
            cout << "  Colisiones      : " << tablaVirus.getColisiones() << "\n";
            cout << "  Factor de carga : " << fixed << setprecision(4) << tablaVirus.getFactorCarga() << "\n";

        } else if (seleccion == 2) {
            // Se busca el virus y se muestran sus datos
            titulo("BUSCAR VIRUS POR ID");
            int pos = pedirVirus(tablaVirus, "  ID del virus: ");
            if (pos != -1) {
                DNASequence v = tablaVirus.obtener(pos);
                cout << "  Encontrado en la casilla " << pos << "\n";
                cout << "  ID       : " << v.id << "\n";
                cout << "  Longitud : " << v.sequence.size() << " bases\n";
                cout << "  Inicio   : " << v.sequence.substr(0, 60) << "...\n";
            }

        } else if (seleccion == 3) {
            // Se cuentan los k-mers del virus y se sacan los n más repetidos con el heap
            titulo("K-MERS (doble hashing) Y TOP N (max-heap)");
            int pos = pedirVirus(tablaVirus, "  ID del virus: ");
            if (pos != -1) {
                cout << "  Valor de k (1 a 8): ";
                int k = leerNumero();
                cout << "  Cuantos mostrar (n): ";
                int n = leerNumero();
                if (k < 1 || k > 8 || n < 1) {
                    cout << "  >> Valores no validos\n";
                } else {
                    DNASequence v = tablaVirus.obtener(pos);
                    // Se cuentan los k-mers con la tabla de doble hashing
                    TablaKmers tabla(k);
                    tabla.contarDe(v.sequence);

                    cout << "  Casillas de la tabla : " << tabla.getTamano() << "\n";
                    cout << "  K-mers distintos     : " << tabla.getDistintos() << "\n";
                    cout << "  Colisiones           : " << tabla.getColisiones() << "\n\n";

                    // Se meten todos los pares al heap y se sacan los n mayores
                    MaxHeap heap;
                    vector<ParKmer> pares = tabla.obtenerPares();
                    for (int i = 0; i < pares.size(); i++) {
                        heap.insertar(pares[i]);
                    }
                    cout << "  Top " << n << " k-mers:\n";
                    for (int i = 1; i <= n && !heap.vacio(); i++) {
                        ParKmer p = heap.extraerMax();
                        cout << "    " << setw(2) << i << ". " << p.kmer << "  -> " << p.conteo << " veces\n";
                    }
                }
            }

        } else if (seleccion == 4) {
            // Se arma el grafo del virus y se imprime su matriz de adyacencia
            titulo("GRAFO DE PAREJAS (matriz de adyacencia 16 x 16)");
            int pos = pedirVirus(tablaVirus, "  ID del virus: ");
            if (pos != -1) {
                GrafoPares grafo;
                grafo.construirDe(tablaVirus.obtener(pos).sequence);
                grafo.mostrar();
            }

        } else if (seleccion == 5) {
            // Se comparan dos virus con la similitud coseno
            titulo("COMPARAR DOS VIRUS (similitud coseno)");
            int pos1 = pedirVirus(tablaVirus, "  ID del primer virus : ");
            int pos2 = -1;
            if (pos1 != -1) {
                pos2 = pedirVirus(tablaVirus, "  ID del segundo virus: ");
            }
            if (pos1 != -1 && pos2 != -1) {
                string adn1 = tablaVirus.obtener(pos1).sequence;
                string adn2 = tablaVirus.obtener(pos2).sequence;
                GrafoPares g1, g2;
                g1.construirDe(adn1);
                g2.construirDe(adn2);
                cout << fixed << setprecision(4);
                cout << "  K-mers, k = 3 : " << similitudKmers(adn1, adn2, 3) << "\n";
                cout << "  K-mers, k = 6 : " << similitudKmers(adn1, adn2, 6) << "\n";
                cout << "  Grafo         : " << similitudGrafo(g1, g2) << "\n";
                cout << "  (1 = misma composicion, 0 = nada en comun)\n";
            }

        } else if (seleccion == 0) {
            cout << "\nHasta luego.\n";

        } else {
            // Si pone otro número
            cout << "  >> Opcion no valida, elige un numero del 0 al 5\n";
        }
    }
}