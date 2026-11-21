#ifndef SIMILITUD_H
#define SIMILITUD_H

#include <string>
#include "GrafoPares.h"
using namespace std;

double similitudKmers(const string& adn1, const string& adn2, int k);
double similitudGrafo(GrafoPares& g1, GrafoPares& g2);

#endif