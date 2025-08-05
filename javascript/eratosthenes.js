/*
  Author:  Vincent T. Mossman
  Updated: July 25, 2018
*/

/*
eratosthenesFull returns an array of size n containing integers from 1 to n
 inclusive where all prime integers appear as themselves and all composite
 integers appear as 0.
*/
function eratosthenesFull(n) {

  // create empty sieve
  let sieve = [1];

  // initialize sieve
  for (i=sieve[0];i<n;i++) {
    sieve.push(i+1);
  } //end for

  // run sieve
  p=2;
  while (p<n) {
    for (i=(p-1);i<n;i+=p) {
      if (sieve[i] != p) {
        sieve[i]=0;
      } //end if
    } //end for
    p++;
  } //end while

  return sieve;

} //end eratosthenesFull

/*
eratosthenesReduced returns an array of all prime numbers from 1 to n inclusive.
*/
function eratosthenesReduced(n) {

  // run sieve
  let sieve = eratosthenesFull(n);

  // remove redundant 0s
  do {
    p=sieve.indexOf(0);
    if (p==-1) {
      break;
    } //end if
    sieve.splice(p, 1);
  } while (true);

  return sieve;

} //end eratosthenesReduced
