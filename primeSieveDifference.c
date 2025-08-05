/* Some fun with prime numbers
   Author:     Vincent T. Mossman
   Compile by: gcc -o primeSieveDifference primeSieveDifference.c
   Run by:     ./prime
*/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <stdbool.h>
#include "eratosthenes.c"

bool allEqual(long unsigned int *, long unsigned int, long unsigned int);

int main(int argc, char * argv[]) {

  if (argc != 2) {
    printf("Usage: %s <followed by [NAT to count to]>\n", argv[0]);
    exit(-1);
  }

  long unsigned int max, i, *primes, numPrimes, dif, degreeTwo[2] = {0, 0};
  sscanf(argv[1], "%ld", &max);

  primes = pth_eratosthenesPrime(max, &numPrimes);

  for (i = 1; i < numPrimes; i++) {
    dif = primes[i] - primes[i-1];
    if (allEqual(degreeTwo,2,dif)) {
      printf("{%ld %ld} ",dif,dif);
      degreeTwo[0]=0; degreeTwo[1]=0;
    } else {
      appendDif(degreeTwo,2,dif);
    }
    //printf("%ld ", dif);
  }
  printf("\n");


bool allEqual(long unsigned int *array,
              long unsigned int arraySize,
              long unsigned int dif) {
  bool allMatch=true;
  long unsigned int i;
  for (i=0;i<arraySize;i++) {
    if (array[i]!=dif) {
      allMatch=false;
    } // end if
  } // end for
  return allMatch;
}

void appendDif(long unsigned int *array,
               long unsigned int arraySize,
               long unsigned int dif) {
  long unsigned int i=0;
  while (array[i]==dif) {
    i++;
  }
  array[i]=dif;
}
