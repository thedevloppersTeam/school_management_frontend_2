/**
 * Une session de classe telle que l'API la rend.
 *
 * PAS de `track` ici, et ce n'est pas un oubli : le modèle ne porte pas de
 * filière sur `Class` ni sur `ClassSession` — elle vit sur l'inscription
 * (`Enrollment.trackId`) et sur la matière (`ClassSubject.trackId`), et une
 * même salle en héberge plusieurs. Le champ déclaré ici n'avait donc aucune
 * source de données derrière lui, mais sa seule présence dans le type suffisait
 * à faire écrire des replis « filière à défaut de lettre » qui affichaient une
 * salle inexistante. Voir « La Règle des Deux Champs » (DESIGN.md) et
 * `lib/classes/labels.ts`.
 */
export interface ApiClassSession {
  id: string
  class: {
    id: string
    letter: string
    classType: { id: string; name: string; isTerminal: boolean; hasTrack: boolean }
  }
  academicYear: { id: string; name: string }
  displayName?: string
}
