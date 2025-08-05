/*
  Some fun with prime numbers. Program lists all natural numbers to user
   defined maximum decomposed to the 1st degree.
  Author:     Vincent T. Mossman
  Compile by: gcc -o naturalDecomposition naturalDecomposition.c
  Run by:     ./naturalDecomposition <followed by [NAT maxumim]>
*/

#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
//#include <time.h>
#include "eratosthenes.c"

int main(int argc, char * argv[]) {

  long unsigned int max, *sieve, i, lastPrime=1, j;
  FILE *f = fopen("naturalDecomposition.txt", "w");
  if (f == NULL) {
    printf("Error opening file!\n");
    exit(1);
  }

  // get sieve size
  if (argc != 2) {
    printf("Usage: %s <followed by [NAT] maximum>\n", argv[0]);
    exit(-1);
  }
  sscanf(argv[1], "%ld", &max);

  // run sieve
  sieve = eratosthenesFull(max);

  // display natural decomposition
  fprintf(f,"{");
  for (i = 0; i < max; i++) {
    if (sieve[i] >= lastPrime) {
      lastPrime = sieve[i];
      fprintf(f,"%ld}\n{", sieve[i]);
    } else {
      fprintf(f,"%ld ",sieve[i]);
    }
  }

  printf("\nDone.\n\n");

}
