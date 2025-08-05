/*
  Author: Vincent T. Mossman
  Date:   October 18, 2016
*/

#include <stdbool.h>

/******************************************************************************
* Function isPrime returns true if n is prime, else returns false             *
******************************************************************************/
bool isPrime(long int n) {
  
  long int i = 2;

  // find divisor (if any)
  while (n % i != 0) {
    if (i > (n / 2)) {
        i = n;
        break;
    }
    i++;
  } // end while

  // determine primality
  if (i < n) {
    return false;
  }
  else {
    return true;
  } // end if

} // end isPrime
