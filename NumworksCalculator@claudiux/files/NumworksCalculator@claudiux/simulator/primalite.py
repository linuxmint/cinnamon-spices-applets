from math import sqrt
def estpremier(n):
  if n<2:
    return False

  if n == 2: # 2 est premier
    return True

  if n%2 == 0: # un nombre pair autre que 2 n'est pas premier
    return False

  p = 3
  rac_n = sqrt(n) # racine carree positive de n

  while p <= rac_n :
    if n%p == 0 : # si n est divisible par p, alors il n'est pas premier.
      print (n, "est divisible par", p)
      return False
    p += 2 # p devient le nombre impair suivant

  return True


n=int(input("Test de primalite de ? "))
print(estpremier(n))
