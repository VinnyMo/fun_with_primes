/* Some fun with prime numbers
   Author:     Vincent T. Mossman
   Compile by: gcc -o primeDifference primeDifference.c
   Run by:     ./prime
*/

#include "primality.c"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

int main(int argc, char * argv[]) {

  if (argc != 2) {
    printf("Usage: %s <followed by [NAT to count to]>\n", argv[0]);
    exit(-1);
  }

  int COUNT_TO, i, max = 0;
  sscanf(argv[1], "%d", &COUNT_TO);
  int track[3] = {1, 0, 0}; //Previous Prime Position, Total Distance, Total Primes
 
  //triSeries vars
  int triSeries[2] = {0, 0};
  int luciferCounter = 0, othersCounter = 0, j, lastUnique = 1;
  int findUnique[120]; //max difference under 1 mil is 114

  for (i = 0; j < 120; i++) {
    findUnique[i] = 0;
  }

  printf("\n");
  clock_t begin = clock();
	
  for (i = 1; i <= COUNT_TO; i++) {
    if (isPrime(i)){
      track[1] = track[1] + (i - track[0]);
      if (i - track[0] > max) {
	max = i - track[0];
      }

      /*
      //triSeries test
      if (triSeries[1] == i - track[0]) {
	if (findUnique[lastUnique - 1] < i - track[0]) {
	  printf("{%d %d %d} \n", i - track[0], i - track[0], i - track[0]);
	  findUnique[lastUnique] = i - track[0];
	  lastUnique++;
	}
	      
	if (i - track[0] == 6) {
	  luciferCounter++;
	}
	else {
	  othersCounter++;
	}
	triSeries[0] = 0;
	triSeries[1] = 0;
        }
        else if (triSeries[0] == i - track[0]) {
	  triSeries[1] = i - track[0];
	}
	else {
	  triSeries[0] = i - track[0];
	} //end triSeries test
      */
      
      //biSeries test
      if (triSeries[0] == i - track[0]) {

	int k, previouslyFound = 0;
	for (k = 0; k < lastUnique; k++) {
	  if (findUnique[k] == i - track[0]) {
	    previouslyFound = 1;
	    break;
	  }
	}

        if (previouslyFound == 0) {
          printf("{%d %d} \n", i - track[0], i - track[0]);
          findUnique[lastUnique] = i - track[0];
          lastUnique++;
        }

	othersCounter++;

        triSeries[0] = 0;
        triSeries[1] = 0;
      }
      else {
	triSeries[0] = i - track[0];
      }

      track[0] = i;
      track[2]++;
    }
  }

  clock_t end = clock();
  double time_spent = (double) (end - begin) / CLOCKS_PER_SEC;
 
  printf("\nCPU execution time: %0.3lfs\n", time_spent);
  printf("Average difference between primes: %0.3lf\n", (double) track[1] / (double) track[2]);
  printf("Max difference between primes: %d\n\n", max);

  /*  
  //triSeries results
  printf("Lucifer Prime Series: %d\n", luciferCounter);
  printf("All other tri-series: %d\n\n", othersCounter);
  */

  //biSeries results
  printf("All bi-series: %d\n\n", othersCounter);
}
