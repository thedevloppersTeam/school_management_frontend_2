/**
 * Règle de mot de passe, contrôlée avant l'envoi pour éviter un aller-retour.
 * Le serveur applique la même règle et reste seul juge : ce contrôle n'est
 * qu'un confort de saisie.
 *
 *  - 8 caractères au moins ;
 *  - 72 octets au plus (UTF-8) ;
 *  - au moins une lettre et au moins un chiffre.
 */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_BYTES = 72

/** Message à afficher si le mot de passe ne respecte pas la règle, sinon null. */
export function passwordPolicyError(password: string): string | null {
  if ([...password].length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_BYTES} octets`
  }
  if (!/\p{L}/u.test(password) || !/\p{Nd}/u.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et au moins un chiffre"
  }
  return null
}
