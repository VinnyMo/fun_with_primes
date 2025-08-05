#include <stdlib.h>
#include <stdio.h>
#include <stdbool.h>
#include <time.h>

/******************************************************************
* Function isPrime returns true if n is prime, else returns false *
******************************************************************/
bool isPrime(long int n) {

  long int i = 2;

  while (n % i != 0) {
    if (i > (n / 2)) {
        i = n;
        break;
    }
    i++;
  }
  printf("%ld", i);
  if (i < n) {
    printf(" ");
    return false;
  }
  else {
    return true;
  }

}

int main(int argc, char * argv[]) {

  if (argc != 2) {
    printf("Usage: %s <followed by [NAT] to find divisors up to>\n", argv[0]);
    exit(-1);
  }

  long int test, i;
  sscanf(argv[1], "%ld", &test);

  printf("{");

  clock_t begin = clock();
  for (i = 1;(int) i <= (int) test; i++) {
    if (isPrime(i)) {
      printf("} {");
    }
  }

  clock_t end = clock();
  double time_spent = (double) (end - begin) / CLOCKS_PER_SEC;

  printf("\nCPU execution time: %0.3fs\n\n", time_spent);

}
