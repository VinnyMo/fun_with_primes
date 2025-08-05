/* Some fun with prime numbers
   Author:     Vincent T. Mossman
   Compile by: gcc -o prime prime.c
   Run by:     ./prime
*/

#include "primality.c"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

int main(int argc, char * argv[]) {

  if (argc != 2) {
    printf("Usage: %s <followed by [NAT to test primality]>\n", argv[0]);
    exit(-1);
  }

  long int test;
  sscanf(argv[1], "%lu", &test);

  clock_t begin = clock();

  if (isPrime(test)) {
    printf("\n%lu is prime\n", test);
  }
  else {
    printf("\n%lu is composite\n", test);
  }

  clock_t end = clock();
  double time_spent = (double) (end - begin) / CLOCKS_PER_SEC;

  printf("\nCPU execution time: %0.3fs\n\n", time_spent);

}
