// =====================================================================
//  GENERADO CON IA — solo para la interfaz gráfica "Genoma Lab".
//  Convierte los resultados de las estructuras (estructuras/) a JSON y
//  arma las trazas de las animaciones. No contiene estructuras propias.
// =====================================================================
#include "Comandos.h"
#include <cmath>
#include "TablaKmers.h"
#include "MaxHeap.h"
#include "GrafoPares.h"
#include "Trazas.h"
#include "Similitud.h"




// =====================================================================
// trazakmers <id> <k> <metodo> <limite>: la "película" de las inserciones
// =====================================================================
json comandoTrazakmers(TablaVirus& tabla, const string& id, int k, const string& metodo, int limite) {
    json respuesta;

    // ----- 1. Encontrar el virus con la tabla hash 1 -----
    int pos = tabla.buscar(id);
    if (pos == -1) {
        respuesta["ok"] = false;
        respuesta["error"] = "No existe el virus: " + id;
        return respuesta;
    }
    string adn = tabla.obtener(pos).sequence;

    // ----- 2. Una tabla de k-mers con el método que pidieron -----
    bool doble = (metodo == "doble");          // "doble" -> true, "lineal" -> false
    TablaKmers tablaK(k, doble);

    respuesta["ok"] = true;
    respuesta["id"] = id;
    respuesta["k"] = k;
    respuesta["metodo"] = metodo;
    respuesta["tamanoTabla"] = tablaK.getTamano();
    respuesta["inserciones"] = json::array();

    // ----- 3. La ventanita, pero solo las primeras "limite" ventanas -----
    for (int i = 0; i + k <= adn.size() && i < limite; i++) {
        string pedazo = adn.substr(i, k);

        json ins;                               // el formulario de esta inserción
        ins["ventana"] = i;
        ins["kmer"] = pedazo;

        // Si tiene letras raras, no se inserta: se anota como "descartado"
        if (!esValido(pedazo)) {
            json s;
            s["pos"] = -1;
            s["kmerEnCasilla"] = nullptr;
            s["resultado"] = "descartado";
            ins["saltos"] = json::array();
            ins["saltos"].push_back(s);
            ins["conteoFinal"] = 0;
            respuesta["inserciones"].push_back(ins);
            continue;                           // sigo con la siguiente ventana
        }

        // La tabla inserta y la traza anota los saltos
        TrazaKmer t = trazarInsercionKmer(tablaK, pedazo, doble);

        ins["hash"] = to_string(t.hash);       // como texto: es muy grande para JavaScript
        ins["inicio"] = t.inicio;
        ins["paso"] = t.paso;

        // Paso cada línea de la libreta al JSON
        ins["saltos"] = json::array();
        for (int j = 0; j < t.saltos.size(); j++) {
            json s;
            s["pos"] = t.saltos[j].pos;
            if (t.saltos[j].kmerEnCasilla == "") {
                s["kmerEnCasilla"] = nullptr;   // casilla vacía -> null
            } else {
                s["kmerEnCasilla"] = t.saltos[j].kmerEnCasilla;
            }
            s["resultado"] = t.saltos[j].resultado;
            ins["saltos"].push_back(s);
        }

        ins["conteoFinal"] = t.conteoFinal;
        respuesta["inserciones"].push_back(ins);
    }

    return respuesta;
}




// =====================================================================
// buscar <id>: la búsqueda en la tabla hash 1, paso a paso
// =====================================================================
json comandoBuscar(TablaVirus& tabla, const string& id) {
    json respuesta;
    TrazaBusqueda t = trazarBusqueda(tabla, id);

    respuesta["ok"] = true;              // la búsqueda funcionó, aunque no lo encuentre
    respuesta["id"] = id;

    // Cómo crece el hash letra por letra
    respuesta["hashPasos"] = json::array();
    for (int i = 0; i < t.hashPasos.size(); i++) {
        json p;
        p["letra"] = string(1, t.hashPasos[i].letra);
        p["valor"] = to_string(t.hashPasos[i].valor);    // texto: muy grande para JavaScript
        respuesta["hashPasos"].push_back(p);
    }

    respuesta["hash"] = to_string(t.hash);
    respuesta["tamano"] = tabla.getTamano();
    respuesta["inicio"] = t.inicio;

    // Cada casilla revisada
    respuesta["pasos"] = json::array();
    for (int i = 0; i < t.pasos.size(); i++) {
        json p;
        p["pos"] = t.pasos[i].pos;
        p["ocupada"] = t.pasos[i].ocupada;
        if (t.pasos[i].ocupada) {
            p["idEnCasilla"] = t.pasos[i].idEnCasilla;
        } else {
            p["idEnCasilla"] = nullptr;                   // casilla vacía -> null
        }
        p["igual"] = t.pasos[i].igual;
        respuesta["pasos"].push_back(p);
    }

    respuesta["encontrado"] = (t.posFinal != -1);
    respuesta["posFinal"] = t.posFinal;

    return respuesta;
}




// =====================================================================
// grafo <id> [limiteArcos]: matriz 16x16 del grafo de Khan et al + datos para animar cómo se construye
// =====================================================================
string nombrePareja(int indice) {                    // 3 -> "AT", 9 -> "GC"
    string letras = "ACGT";
    return string(1, letras[indice / 4]) + letras[indice % 4];
}

double redondear4(double x) {                        // 4 decimales para el JSON
    return round(x * 10000) / 10000;
}

json comandoGrafo(TablaVirus& tabla, const string& id, int limiteArcos) {
    json respuesta;

    // ----- 1. Encontrar el virus con la tabla hash 1 -----
    int pos = tabla.buscar(id);
    if (pos == -1) {
        respuesta["ok"] = false;
        respuesta["error"] = "No existe el virus: " + id;
        return respuesta;
    }
    string adn = tabla.obtener(pos).sequence;

    // ----- 2. El grafo (la estructura del proyecto) -----
    GrafoPares grafo;
    grafo.construirDe(adn);

    // ----- 3. Las parejas cortadas de 2 en 2 (solo para la animación) -----
    //          mismo corte que construirDe: índice 0..15, o -1 si es inválida
    vector<int> pares;
    int invalidas = 0;
    for (int i = 0; i + 1 < adn.size(); i += 2) {
        int p = indicePareja(adn[i], adn[i + 1]);
        pares.push_back(p);
        if (p == -1) invalidas++;
    }

    respuesta["ok"] = true;
    respuesta["id"] = id;

    respuesta["nombres"] = json::array();
    for (int i = 0; i < 16; i++) {
        respuesta["nombres"].push_back(nombrePareja(i));
    }

    respuesta["parejas"] = pares.size();
    respuesta["parejasInvalidas"] = invalidas;

    // ----- 4. La matriz 16x16, leída con getPeso -----
    respuesta["matriz"] = json::array();
    for (int i = 0; i < 16; i++) {
        json fila = json::array();
        for (int j = 0; j < 16; j++) {
            fila.push_back(redondear4(grafo.getPeso(i, j)));
        }
        respuesta["matriz"].push_back(fila);
    }

    // ----- 5. Los arcos entre las primeras "limiteArcos" parejas -----
    //          (los mismos dos for de construirDe, pero solo al inicio)
    int hasta = limiteArcos;
    if (hasta > pares.size()) hasta = pares.size();

    respuesta["arcosEjemplo"] = json::array();
    for (int a = 0; a < hasta; a++) {
        for (int b = a + 1; b < hasta; b++) {
            if (pares[a] >= 0 && pares[b] >= 0) {
                json arco;
                arco["a"] = a;
                arco["b"] = b;
                arco["desde"] = nombrePareja(pares[a]);
                arco["hasta"] = nombrePareja(pares[b]);
                arco["distancia"] = b - a;
                arco["peso"] = redondear4(1.0 / (b - a));
                respuesta["arcosEjemplo"].push_back(arco);
            }
        }
    }

    return respuesta;
}




// =====================================================================
// experimento: los 218 virus con k = 3 y k = 6, sondeo lineal vs doble
// hashing (usa las tablas de k-mers del proyecto)
// =====================================================================
json comandoExperimento(const vector<DNASequence>& virus) {
    json respuesta;
    respuesta["ok"] = true;
    respuesta["resultados"] = json::array();
    respuesta["porVirus"] = json::array();

    int valoresK[2] = {3, 6};

    for (int x = 0; x < 2; x++) {
        int k = valoresK[x];

        long long totalLineal = 0;
        long long totalDoble = 0;
        double sumaFactorCarga = 0;

        for (int i = 0; i < virus.size(); i++) {
            // La misma secuencia contada con los dos métodos
            TablaKmers lineal(k, false);
            lineal.contarDe(virus[i].sequence);
            TablaKmers doble(k, true);
            doble.contarDe(virus[i].sequence);

            totalLineal += lineal.getColisiones();
            totalDoble += doble.getColisiones();
            // El factor de carga es igual en los dos: mismos k-mers distintos
            sumaFactorCarga += (double)doble.getDistintos() / doble.getTamano();

            json v;
            v["id"] = virus[i].id;
            v["k"] = k;
            v["lineal"] = lineal.getColisiones();
            v["doble"] = doble.getColisiones();
            respuesta["porVirus"].push_back(v);
        }

        int n = virus.size();
        double factorPromedio = round(sumaFactorCarga / n * 10000) / 10000;

        json rl;
        rl["k"] = k;
        rl["metodo"] = "lineal";
        rl["colisionesTotal"] = totalLineal;
        rl["colisionesPromedio"] = round((double)totalLineal / n * 100) / 100;
        rl["factorCargaPromedio"] = factorPromedio;
        respuesta["resultados"].push_back(rl);

        json rd;
        rd["k"] = k;
        rd["metodo"] = "doble";
        rd["colisionesTotal"] = totalDoble;
        rd["colisionesPromedio"] = round((double)totalDoble / n * 100) / 100;
        rd["factorCargaPromedio"] = factorPromedio;
        respuesta["resultados"].push_back(rd);
    }

    return respuesta;
}




// =====================================================================
// heap <id> <k> <n>: el top n, anotando cada intercambio del max-heap
// =====================================================================
json intercambiosAJson(const vector<pair<int, int>>& swaps) {   // [[3,1],[1,0]]
    json lista = json::array();
    for (int i = 0; i < swaps.size(); i++) {
        lista.push_back({swaps[i].first, swaps[i].second});
    }
    return lista;
}

json comandoHeap(TablaVirus& tabla, const string& id, int k, int n) {
    json respuesta;

    // ----- 1. Encontrar el virus con la tabla hash 1 -----
    int pos = tabla.buscar(id);
    if (pos == -1) {
        respuesta["ok"] = false;
        respuesta["error"] = "No existe el virus: " + id;
        return respuesta;
    }

    // ----- 2. Contar sus k-mers (doble hashing) -----
    TablaKmers huella(k);
    huella.contarDe(tabla.obtener(pos).sequence);
    vector<ParKmer> lista = huella.obtenerPares();

    respuesta["ok"] = true;
    respuesta["id"] = id;
    respuesta["k"] = k;
    respuesta["n"] = n;
    respuesta["operaciones"] = json::array();

    MaxHeap heap;

    // ----- 3. Insertar todos, anotando los intercambios de subir -----
    for (int i = 0; i < lista.size(); i++) {
        vector<pair<int, int>> swaps = trazarInsertarHeap(heap, lista[i]);

        json op;
        op["op"] = "insertar";
        op["par"]["kmer"] = lista[i].kmer;
        op["par"]["conteo"] = lista[i].conteo;
        op["intercambios"] = intercambiosAJson(swaps);
        respuesta["operaciones"].push_back(op);
    }

    // ----- 4. Extraer n veces: raíz con el último + los de bajar -----
    respuesta["top"] = json::array();
    for (int i = 0; i < n && !heap.vacio(); i++) {
        ParKmer mayor;
        vector<pair<int, int>> swaps = trazarExtraerHeap(heap, mayor);

        json op;
        op["op"] = "extraer";
        op["par"]["kmer"] = mayor.kmer;
        op["par"]["conteo"] = mayor.conteo;
        op["intercambios"] = intercambiosAJson(swaps);
        respuesta["operaciones"].push_back(op);

        json p;
        p["kmer"] = mayor.kmer;
        p["conteo"] = mayor.conteo;
        respuesta["top"].push_back(p);
    }

    return respuesta;
}



// =====================================================================
// comparar <id1> <id2>: similitud coseno (k = 3, k = 6 y grafo)
// + matriz de diferencias. Usa Similitud.h (código del estudiante)
// =====================================================================
json comandoComparar(TablaVirus& tabla, const string& id1, const string& id2) {
    json respuesta;

    int pos1 = tabla.buscar(id1);
    int pos2 = tabla.buscar(id2);
    if (pos1 == -1 || pos2 == -1) {
        respuesta["ok"] = false;
        respuesta["error"] = "No existe el virus: " + (pos1 == -1 ? id1 : id2);
        return respuesta;
    }
    string adn1 = tabla.obtener(pos1).sequence;
    string adn2 = tabla.obtener(pos2).sequence;

    GrafoPares g1, g2;
    g1.construirDe(adn1);
    g2.construirDe(adn2);

    respuesta["ok"] = true;
    respuesta["id1"] = id1;
    respuesta["id2"] = id2;
    respuesta["simKmers3"] = round(similitudKmers(adn1, adn2, 3) * 1000000) / 1000000;
    respuesta["simKmers6"] = round(similitudKmers(adn1, adn2, 6) * 1000000) / 1000000;
    respuesta["simGrafo"]  = round(similitudGrafo(g1, g2) * 1000000) / 1000000;

    // Matriz 1 - matriz 2: dónde un virus tiene más peso que el otro
    respuesta["diferenciaGrafo"] = json::array();
    for (int i = 0; i < 16; i++) {
        json fila = json::array();
        for (int j = 0; j < 16; j++) {
            fila.push_back(redondear4(g1.getPeso(i, j) - g2.getPeso(i, j)));
        }
        respuesta["diferenciaGrafo"].push_back(fila);
    }

    return respuesta;
}