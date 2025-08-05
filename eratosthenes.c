/*
  Author:  Vincent T. Mossman
  Updated: November 5, 2016
*/

#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <pthread.h>

// content summary
long unsigned int *eratosthenesFull(long unsigned int n);
  /* eratosthenesFull returns an array of size n containing all numbers between
      1 (index 0) and n (index n-1) that have been decomposed to their most
      basic homogeneous components.
      */
long unsigned int *eratosthenesPrime(long unsigned int n,
                                     long unsigned int *size);
  /* eratosthenesPrime returns an array of unpredictable size (guaranteed to be
      less than n, if n>3) containing all prime numbers between 1 and n
      (inclusive).
      */
long unsigned int *pth_eratosthenesPrime(long unsigned int n,
                                         long unsigned int *size);
  /* pth_eratosthenesPrime takes advantage of multicore processing using
      pthreads to generate an array of unpredictable size (guaranteed to be less
      than n, if n>3) containing all prime numbers between 1 and n (inclusive).
      */
void *threadPartialSieve(void *rank);
  /* threadPartialSieve uses pthreads to split the work of a reduced Sieve of
      Eratosthenes between a number of threads. Parallelized, it can only be
      used to find a list of prime numbers, not a full decomposition.
      */

// definitions
#define TRUE 1
#define FALSE 0

// global variables
int *isPrimeArray;
int numberOfThreads = 4;
long unsigned int globalN;

/******************************************************************************
* Function eratosthenesFull returns array of decomposed naturals of size n.   *
*  this is not quite standard for a Sieve of Eratosthenes as it is typically  *
*  used to find prime numbers, not "natural decomposition".                   *
******************************************************************************/
long unsigned int *eratosthenesFull(long unsigned int n) {

  long unsigned int *sieve, i, j;

  // allocate sieve memory and initialize
  sieve = (long unsigned int *) malloc(sizeof(long unsigned int)*n);
  for (i = 0; i < n; i++) {
    sieve[i] = 1;
  } // end for

  // run sieve
  for (i = 0; i < n; i++) {
    for (j = i; j < n; j+=(i+1)) {
      if (sieve[j] == 1) {
        sieve[j] = i+1;
      } // end if
    } // end for (j)
  } // end for (i)

  return sieve;

} // end eratosthenes

/******************************************************************************
* Function eratosthenesPrime returns array of prime numbers between 1 and n.  *
*  Also assigns number of primes in returned array to size.                   *
******************************************************************************/
long unsigned int *eratosthenesPrime(long unsigned int n,
                                     long unsigned int *size) {

  long unsigned int *sieve, *primes, primeCount, lastPrime, i;

  // run sieve
  sieve = eratosthenesFull(n);

  // get primeCount
  primeCount=0;
  lastPrime=1;
  for (i = 0; i < n; i++) {
    if (sieve[i] >= lastPrime) {
      lastPrime = sieve[i];
      primeCount++;
    } // end if
  } // end for
  *size=primeCount;

  // allocate primes memory
  primes = (long unsigned int *) malloc(sizeof(long unsigned int)*primeCount);

  // build primes
  primeCount=0;
  lastPrime=1;
  for (i = 0; i < n; i++) {
    if (sieve[i] >= lastPrime) {
      lastPrime = sieve[i];
      primes[primeCount] = sieve[i];
      primeCount++;
    } // end if
  } // end for

  return primes;

} // end eratosthenesPrime

/******************************************************************************
* Function pth_eratosthenesPrime is a parallelized - but reduced - sieve      *
******************************************************************************/
long unsigned int *pth_eratosthenesPrime(long unsigned int n,
                                         long unsigned int *size) {

  int errorCode;
  long rank;
  long unsigned int *primes, i, j, primeCount;
  pthread_t * threadHandles = (pthread_t *) malloc(numberOfThreads * sizeof(pthread_t));
  globalN=n;

  // allocate global "isPrimeArray" memory and initialize all to "Prime"
  isPrimeArray = (int *) malloc(sizeof(int)*n);
  for (i = 0; i < n; i++) {
    isPrimeArray[i] = TRUE;
  }

  for (rank = 0; rank < numberOfThreads; rank++) {
    if (errorCode = pthread_create(&threadHandles[rank], NULL, threadPartialSieve, (void *) rank) != 0) {
      printf("pthread %ld failed to be created with error code %d\n", rank, errorCode);
    }
  }

  for (rank = 0; rank < numberOfThreads; rank++) {
    if (errorCode = pthread_join(threadHandles[rank], (void **) NULL) != 0) {
      printf("pthread %ld failed to be joined with error code %d\n", rank, errorCode);
    }
  }

  // get primeCount
  primeCount=0;
  for (i = 0; i < n; i++) {
    if (isPrimeArray[i] == TRUE) {
      primeCount++;
    } // end if
  } // end for
  *size=primeCount;

  // allocate primes memory
  primes = (long unsigned int *) malloc(sizeof(long unsigned int)*primeCount);

  // build primes
  primeCount=0;
  for (i = 0; i < n; i++) {
    if (isPrimeArray[i] == TRUE) {
      primes[primeCount] = i+1;
      primeCount++;
    } // end if
  } // end for

  return primes;

} // end pth_eratosthenesPrime

void *threadPartialSieve(void *rank) {

  long unsigned int i, j;

  // run sieve
  for (i = (long unsigned int) rank+1; i < sqrt(globalN); i+=numberOfThreads) {
    for (j = i; j < globalN; j+=(i+1)) {
      if (i > (long unsigned int) rank+1 && (i+1)%2 == 0) {break;}
      if (j > i) {
        isPrimeArray[j] = FALSE;
      } // end if
    } // end for (j)
  } // end for (i)

} // end threadPartialSieve
