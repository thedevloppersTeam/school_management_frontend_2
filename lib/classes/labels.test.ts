/**
 * Libellés de classe et de salle — deux champs, jamais une chaîne.
 *
 * Les deux tests qui comptent :
 *   - la FILIÈRE ne ressort jamais, quoi qu'on passe en entrée ;
 *   - une salle absente rend une chaîne VIDE, pas un tiret et pas « undefined »
 *     imprimé dans une cellule.
 */
import { libelleClasseSalle, type ClasseSource, type SessionSource } from './labels'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

/** Rendu lisible d'un resultat, pour que l'echec dise ce qui a change. */
const fmt = (s: Parameters<typeof libelleClasseSalle>[0]) => {
  const r = libelleClasseSalle(s)
  return `classe="${r.classe}" salle="${r.salle}"`
}

// ── Donnees completes ───────────────────────────────────────────────────────
{
  const session: SessionSource = { class: { letter: 'A', classType: { name: '1e AF' } } }
  check('session hydratee', fmt(session), 'classe="1e AF" salle="A"')

  const classe: ClasseSource = { letter: 'B', classType: { name: 'NS3' } }
  check('classe + classType, sans session', fmt(classe), 'classe="NS3" salle="B"')

  // La lettre reste telle quelle : c'est une donnee, pas un style. Aucune mise
  // en majuscule, aucun prefixe « Salle » — l'etiquette appartient a l'ecran.
  check('lettre minuscule conservee', fmt({ letter: 'c', classType: { name: '6e AF' } }), 'classe="6e AF" salle="c"')
  check('salle a deux caracteres', fmt({ letter: 'A1', classType: { name: '9e AF' } }), 'classe="9e AF" salle="A1"')
}

// ── classType manquant ──────────────────────────────────────────────────────
{
  // On rend la salle quand meme : une information partielle vaut mieux qu'une
  // ligne vide, et l'ecran sait afficher « Aucune classe » en face.
  check('classType absent', fmt({ letter: 'A' }), 'classe="" salle="A"')
  check('classType null', fmt({ letter: 'A', classType: null }), 'classe="" salle="A"')
  check('classType.name absent', fmt({ letter: 'A', classType: {} }), 'classe="" salle="A"')
  check('classType.name null', fmt({ letter: 'A', classType: { name: null } }), 'classe="" salle="A"')
}

// ── letter vide ou absente ──────────────────────────────────────────────────
{
  check('letter chaine vide', fmt({ letter: '', classType: { name: '1e AF' } }), 'classe="1e AF" salle=""')
  check('letter absente', fmt({ classType: { name: '1e AF' } }), 'classe="1e AF" salle=""')
  check('letter null', fmt({ letter: null, classType: { name: '1e AF' } }), 'classe="1e AF" salle=""')
}

// ── Valeurs a espaces ───────────────────────────────────────────────────────
{
  check('espaces autour de la lettre', fmt({ letter: '  A  ', classType: { name: '1e AF' } }), 'classe="1e AF" salle="A"')
  check('espaces autour du niveau', fmt({ letter: 'A', classType: { name: '  1e AF  ' } }), 'classe="1e AF" salle="A"')
  // Une lettre faite d'espaces est une salle ABSENTE, pas une salle nommee
  // « espace » : sans cette coupe, la cellule affiche un blanc qu'on ne peut
  // pas distinguer d'une donnee.
  check('lettre faite d espaces', fmt({ letter: '   ', classType: { name: '1e AF' } }), 'classe="1e AF" salle=""')
  check('niveau fait d espaces', fmt({ letter: 'A', classType: { name: '   ' } }), 'classe="" salle="A"')
}

// ── Entrees vides ou aberrantes ─────────────────────────────────────────────
{
  check('null', fmt(null), 'classe="" salle=""')
  check('undefined', fmt(undefined), 'classe="" salle=""')
  check('session sans class', fmt({ class: null } as SessionSource), 'classe="" salle=""')
  check('objet vide', fmt({}), 'classe="" salle=""')
  check('valeurs non textuelles', fmt({ letter: 42 as unknown as string, classType: { name: 7 as unknown as string } }), 'classe="" salle=""')

  let aLeve = false
  try { libelleClasseSalle(undefined) ; libelleClasseSalle({}) } catch { aLeve = true }
  check('aucune exception', String(aLeve), 'false')
}

// ── AUCUNE FILIERE NE RESSORT, JAMAIS ───────────────────────────────────────
{
  // Le backend n'envoie pas de `track` sur une classe, mais du code mort en
  // lisait un. Meme si un appelant en fournit un, il ne doit ni remplacer la
  // salle, ni s'y ajouter, ni apparaitre dans le niveau.
  const avecFiliere = {
    letter: 'A',
    classType: { name: 'NS4' },
    track: { id: 't1', code: 'LLA', name: 'Lettres' },
    trackId: 't1',
  } as unknown as ClasseSource
  check('track ignore sur la classe', fmt(avecFiliere), 'classe="NS4" salle="A"')

  const sessionAvecFiliere = { class: avecFiliere } as SessionSource
  check('track ignore via la session', fmt(sessionAvecFiliere), 'classe="NS4" salle="A"')

  // Cas le plus pernicieux : la classe n'a pas de lettre. L'ancienne logique
  // `track?.code ?? letter` aurait fait sortir « LLA » comme SALLE.
  const sansLettre = { classType: { name: 'NS4' }, track: { code: 'LLA' } } as unknown as ClasseSource
  check('sans lettre, le code filiere ne remplace pas', fmt(sansLettre), 'classe="NS4" salle=""')

  // Preuve generale : aucun caractere du code de filiere ne sort, dans aucun champ.
  const r = libelleClasseSalle(avecFiliere)
  check('aucun champ ne contient LLA', `${r.classe}|${r.salle}`.includes('LLA'), 'false')
  check('aucun champ ne contient Lettres', `${r.classe}|${r.salle}`.includes('Lettres'), 'false')
}

// ── La forme du resultat est figee ──────────────────────────────────────────
{
  const r = libelleClasseSalle({ letter: 'A', classType: { name: '1e AF' } })
  check('exactement deux champs', Object.keys(r).sort().join(','), 'classe,salle')
  check('jamais undefined en classe', typeof r.classe, 'string')
  check('jamais undefined en salle', typeof r.salle, 'string')
  // Aucune fusion ne sort d'ici : c'est le role de getClassSessionName.
  // Lettre « Z » choisie a dessein : « 1e AF » contient deja un « A ».
  const z = libelleClasseSalle({ letter: 'Z', classType: { name: '1e AF' } })
  check('la classe ne contient pas la salle', z.classe.includes('Z'), 'false')
  check('la salle ne contient pas le niveau', z.salle, 'Z')

  // Objets distincts : un appelant qui mute son resultat n'affecte pas le suivant.
  const a = libelleClasseSalle(null)
  const b = libelleClasseSalle(null)
  a.classe = 'mute'
  check('resultats non partages', b.classe, '')
}

console.log(out.join('\n'))
console.log('\n' + '='.repeat(74))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(74))
process.exit(fail === 0 ? 0 : 1)
