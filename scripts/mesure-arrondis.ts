/**
 * scripts/mesure-arrondis.ts — preuve d'une decision qui touche un document
 * opposable. A rejouer par quiconque veut verifier les chiffres.
 *
 *     npx tsx scripts/mesure-arrondis.ts
 *
 * QUESTION. Le bulletin a longtemps imprime ses moyennes en convertissant
 * chaque Decimal en flottant avant `toFixed(2)`. Un double ne represente pas
 * exactement un demi-centieme : 6,425 exact devient 6,4249999999999998224, et
 * l'arrondi part du mauvais cote. Combien de valeurs imprimees cela deplace-t-il,
 * et de combien ?
 *
 * METHODE. Des bulletins sont construits sur la structure reelle du CPMSL —
 * baremes ronds (/10 /20 /25 /30 /40 /50 /60 /100), notes au pas de 0,25
 * (DR-004), 6 a 11 matieres en R1, 1 a 3 en R2, 1 a 2 en R3. Les fonctions de
 * calcul sont les VRAIES : `lib/bulletin/compute.ts` est importe, rien n'est
 * reimplemente. Seul le FORMATAGE est compare :
 *
 *     AVANT : d.toNumber().toFixed(2)      APRES : formatAverage(d)
 *
 * Aucune donnee d'eleve reelle n'est lue : tout est tire au sort.
 *
 * RESULTAT au 2026-09-17 (chiffres consignes dans docs/DECISIONS.md) :
 *   - moyR1/R2/R3 : ~1,3 % des cellules imprimees changent
 *   - moyenneEtape : ~0,30 %
 *   - moyennes de classe : 0 sur 16 000
 *   - ~3,9 % des bulletins portent au moins une cellule changee
 *   - l'ecart vaut TOUJOURS exactement un centime, dans les deux sens
 *   - aucun verdict Reussi/Echec ne bascule : isPassing lit le Decimal exact
 */
import Decimal from 'decimal.js'
import {
  computeStep, computeClassAverage, formatAverage,
  type SubjectInput, type RubriqueCode,
} from '../lib/bulletin/compute'

const D = (v: string | number) => new Decimal(v)

// Barèmes réels du CPMSL : des valeurs rondes. Notes au pas de 0,25 (DR-004).
const BAREMES = [10, 20, 25, 30, 40, 50, 60, 100]
const ri = (n: number) => Math.floor(Math.random() * n)
const note = (max: number) => D(ri(max * 4 + 1)).dividedBy(4)

function matiere(name: string, r: RubriqueCode, tauxManquant: number): SubjectInput {
  const max = BAREMES[ri(BAREMES.length)]
  const notee = Math.random() >= tauxManquant
  return {
    classSubjectId: `cs-${name}`, name, rubrique: r,
    maxScore: D(max), maxScoreOverride: null, sections: [],
    globalScores: notee ? [note(max)] : [],
    exempted: false,
  }
}

function bulletinEleve(tauxManquant: number): SubjectInput[] {
  const s: SubjectInput[] = []
  const n1 = 6 + ri(6), n2 = 1 + ri(3), n3 = 1 + ri(2)
  for (let i = 0; i < n1; i++) s.push(matiere(`a${i}`, 'R1', tauxManquant))
  for (let i = 0; i < n2; i++) s.push(matiere(`b${i}`, 'R2', tauxManquant))
  for (let i = 0; i < n3; i++) s.push(matiere(`c${i}`, 'R3', tauxManquant))
  return s
}

// ── Les deux formatages ────────────────────────────────────────────────────
const AVANT = (d: Decimal | null) => (d === null ? '—' : d.toNumber().toFixed(2))
const APRES = (d: Decimal | null) => formatAverage(d)

type Compteur = { cellules: number; bouge: number; ecarts: string[] }
const neuf = (): Compteur => ({ cellules: 0, bouge: 0, ecarts: [] })

function note1(c: Compteur, d: Decimal | null, etiquette: string) {
  c.cellules++
  const a = AVANT(d), b = APRES(d)
  if (a !== b) {
    c.bouge++
    if (c.ecarts.length < 2) c.ecarts.push(`${etiquette} ${a} -> ${b} (exact ${d!.toString().slice(0, 20)})`)
  }
}

// `classAverageOf` du chemin actuel : chaque valeur eleve passe par un double
// AVANT d'entrer dans la moyenne de classe, puis le resultat repasse par un
// double. Reproduit tel quel.
function moyClasseActuelle(vals: Array<Decimal | null>): Decimal | null {
  const viaDouble = vals.map((v) => ({
    average: v === null ? null : D(v.toNumber()),
  }))
  const r = computeClassAverage(viaDouble)
  return r === null ? null : D(r.toNumber())
}
function moyClasseExacte(vals: Array<Decimal | null>): Decimal | null {
  return computeClassAverage(vals.map((average) => ({ average })))
}

// ── Ampleur et sens de l'ecart, et impact PAR BULLETIN ────────────────────
{
  let cellules = 0, bouge = 0, bulletins = 0, bulletinsTouches = 0
  const amplitudes = new Map<string, number>()
  let versLeBas = 0
  for (let i = 0; i < 200000; i++) {
    const st = computeStep(bulletinEleve(0.1))
    const vide = st.r1.average === null && st.r2.average === null && st.r3.average === null
    const valeurs: Array<Decimal | null> = [
      st.r1.average, st.r2.average, st.r3.average, vide ? null : st.average,
    ]
    bulletins++
    let touche = false
    for (const v of valeurs) {
      cellules++
      const a = AVANT(v), b = APRES(v)
      if (a === b) continue
      bouge++; touche = true
      const ecart = D(b).minus(D(a))
      const k = ecart.toFixed(2)
      amplitudes.set(k, (amplitudes.get(k) ?? 0) + 1)
      if (ecart.isNegative()) {
        versLeBas++
        if (versLeBas <= 3) {
          console.log(`  [VERS LE BAS] ${a} -> ${b}  exact = ${v!.toString()}`)
          console.log(`                double = ${v!.toNumber().toPrecision(20)}`)
        }
      }
    }
    if (touche) bulletinsTouches++
  }
  console.log(`
${'='.repeat(78)}`)
  console.log('  AMPLITUDE ET SENS  —  200 000 bulletins, 4 cellules chiffrees chacun')
  console.log('='.repeat(78))
  console.log(`  cellules qui bougent : ${bouge}/${cellules} (${(bouge / cellules * 100).toFixed(4)} %)`)
  console.log(`  bulletins portant au moins une cellule qui bouge : ${bulletinsTouches}/${bulletins} ` +
    `(${(bulletinsTouches / bulletins * 100).toFixed(3)} %)`)
  console.log(`  ecarts observes      : ${[...amplitudes.entries()].map(([k, n]) => `${k} (x${n})`).join(', ')}`)
  console.log(`  ecarts vers le BAS   : ${versLeBas}`)
}

for (const taux of [0, 0.15]) {
  const cR = neuf(), cE = neuf(), cCR = neuf(), cCE = neuf()
  let classesDivergentes = 0
  const SALLES = 4000, EFFECTIF = 30

  for (let s = 0; s < SALLES; s++) {
    const steps = Array.from({ length: EFFECTIF }, () => computeStep(bulletinEleve(taux)))

    for (const st of steps) {
      note1(cR, st.r1.average, 'moyR1')
      note1(cR, st.r2.average, 'moyR2')
      note1(cR, st.r3.average, 'moyR3')
      const vide = st.r1.average === null && st.r2.average === null && st.r3.average === null
      note1(cE, vide ? null : st.average, 'moyEtape')
    }

    let divergeIci = false
    for (const col of ['r1', 'r2', 'r3'] as const) {
      const vals = steps.map((st) => st[col].average)
      const a = AVANT(moyClasseActuelle(vals)), b = APRES(moyClasseExacte(vals))
      cCR.cellules++
      if (a !== b) {
        cCR.bouge++; divergeIci = true
        if (cCR.ecarts.length < 2) cCR.ecarts.push(`moyClasse${col.toUpperCase()} ${a} -> ${b}`)
      }
    }
    const valsE = steps.map((st) =>
      st.r1.average === null && st.r2.average === null && st.r3.average === null ? null : st.average)
    const a = AVANT(moyClasseActuelle(valsE)), b = APRES(moyClasseExacte(valsE))
    cCE.cellules++
    if (a !== b) {
      cCE.bouge++; divergeIci = true
      if (cCE.ecarts.length < 2) cCE.ecarts.push(`moyenneClasse ${a} -> ${b}`)
    }
    if (divergeIci) classesDivergentes++
  }

  const pc = (c: Compteur) => `${c.bouge}/${c.cellules} (${(c.bouge / c.cellules * 100).toFixed(4)} %)`
  console.log(`\n${'='.repeat(78)}`)
  console.log(`  ${taux === 0 ? 'TOUT NOTE' : '15 % DE NOTES MANQUANTES'}  —  ${SALLES} salles x ${EFFECTIF} eleves`)
  console.log('='.repeat(78))
  console.log(`  moyR1 / moyR2 / moyR3      : ${pc(cR)}`)
  cR.ecarts.forEach((e) => console.log(`      ex. ${e}`))
  console.log(`  moyenneEtape               : ${pc(cE)}`)
  cE.ecarts.forEach((e) => console.log(`      ex. ${e}`))
  console.log(`  moyClasseR1 / R2 / R3      : ${pc(cCR)}`)
  cCR.ecarts.forEach((e) => console.log(`      ex. ${e}`))
  console.log(`  moyenneClasse (etape)      : ${pc(cCE)}`)
  cCE.ecarts.forEach((e) => console.log(`      ex. ${e}`))
  console.log(`  salles avec >= 1 cellule de classe qui bouge : ${classesDivergentes}/${SALLES}`)
}
