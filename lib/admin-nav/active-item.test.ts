/**
 * Menu d'administration — un SEUL lien actif pour une adresse donnée.
 */
import { activeHref } from './active-item'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(64)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(64)} attendu ${w}, obtenu ${g}`) }
}

// Liens du menu (components/admin/admin-layout-shell.tsx), année active résolue.
const LIENS = [
  '/admin/dashboard',
  '/admin/all-students',
  '/admin/academic-year/annee-1/students',
  '/admin/academic-year/annee-1/grades',
  '/admin/academic-year/annee-1/reports',
  '/admin/archives',
  '/admin/journal',
  '/admin/settings',
  '/admin/settings/releve',
  '/admin/academic-years',
]

check('/admin/settings → Établissement', activeHref('/admin/settings', LIENS), '/admin/settings')
check('/admin/settings/releve → Relevé de notes seul', activeHref('/admin/settings/releve', LIENS), '/admin/settings/releve')
check('/admin/settings-x n’active pas /admin/settings', activeHref('/admin/settings-x', LIENS), 'null')
check('/admin/all-students/123/transcript → Élève', activeHref('/admin/all-students/123/transcript', LIENS), '/admin/all-students')
check('/admin/academic-years/abc → Années Scolaires', activeHref('/admin/academic-years/abc', LIENS), '/admin/academic-years')
check('/admin/academic-year/annee-1/grades/x → Notes', activeHref('/admin/academic-year/annee-1/grades/x', LIENS), '/admin/academic-year/annee-1/grades')
check('/admin/dashboard → Dashboard', activeHref('/admin/dashboard', LIENS), '/admin/dashboard')
check('adresse sans correspondance → aucun', activeHref('/admin/inconnu', LIENS), 'null')
check('/admin seul → aucun', activeHref('/admin', LIENS), 'null')
check('barre finale tolérée', activeHref('/admin/settings/', LIENS), '/admin/settings')
check('lien « # » (année non chargée) ignoré', activeHref('/admin/journal', ['#', '/admin/journal']), '/admin/journal')
check('paramètres de requête du lien ignorés', activeHref('/admin/archives/2', ['/admin/archives?tab=1']), '/admin/archives?tab=1')
check('ordre de la liste sans effet', activeHref('/admin/settings/releve', [...LIENS].reverse()), '/admin/settings/releve')

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
