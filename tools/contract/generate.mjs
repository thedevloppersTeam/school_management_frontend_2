/**
 * tools/contract/generate.mjs — npm run contract:generate (racine du frontend)
 *
 * Génère les validateurs zod des réponses de l'API depuis la copie épinglée du
 * contrat (contract/openapi.json, ADR-007 § 2), vers lib/api/menfp/contract.gen.ts.
 *
 * 1. Vérifie que le SHA-256 de la copie est celui de contract/PROVENANCE.md :
 *    une copie modifiée sans mise à jour de sa provenance est refusée.
 * 2. Lecteur tolérant (ADR-007) : retire `additionalProperties: false` des
 *    schémas, EN MÉMOIRE ; la copie reste identique au fichier du serveur. Les
 *    objets zod générés ignorent alors les champs supplémentaires au lieu de
 *    refuser la réponse.
 * 3. Génère par orval (mode zod seul, syntaxe zod 4), puis ajoute un en-tête
 *    qui nomme le commit serveur et l'empreinte de la copie.
 *
 * Sortie déterministe (aucune date) : la CI régénère et compare au fichier
 * commité (git diff --exit-code).
 */
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { generate } from "orval"

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const copie = join(racine, "contract", "openapi.json")
const provenance = join(racine, "contract", "PROVENANCE.md")
const sortie = join(racine, "lib", "api", "menfp", "contract.gen.ts")

const octets = readFileSync(copie)
const empreinte = createHash("sha256").update(octets).digest("hex")
const texteProvenance = readFileSync(provenance, "utf8")
const commit = /Commit serveur : `([0-9a-f]{40})`/.exec(texteProvenance)?.[1]
const empreinteDeclaree = /SHA-256 de la copie : `([0-9a-f]{64})`/.exec(texteProvenance)?.[1]

if (!commit || !empreinteDeclaree) {
  console.error("contract/PROVENANCE.md : commit serveur ou SHA-256 introuvable.")
  process.exit(1)
}
if (empreinteDeclaree !== empreinte) {
  console.error(
    `contract/openapi.json a pour SHA-256 ${empreinte}, PROVENANCE.md déclare ${empreinteDeclaree}.\n` +
      "Mettez à jour PROVENANCE.md (commit et SHA-256) avec la nouvelle copie.",
  )
  process.exit(1)
}

const contrat = JSON.parse(octets.toString("utf8"))
let retires = 0
;(function tolerer(noeud) {
  if (Array.isArray(noeud)) return noeud.forEach(tolerer)
  if (noeud && typeof noeud === "object") {
    if (noeud.additionalProperties === false) {
      delete noeud.additionalProperties
      retires++
    }
    Object.values(noeud).forEach(tolerer)
  }
})(contrat)

const dossier = mkdtempSync(join(tmpdir(), "cpmsl-contrat-"))
try {
  const entree = join(dossier, "openapi.tolerant.json")
  writeFileSync(entree, JSON.stringify(contrat))
  await generate({
    input: { target: entree },
    output: {
      mode: "single",
      client: "zod",
      target: sortie,
      override: { zod: { version: 4, generateEachHttpStatus: true } },
    },
  })
} finally {
  rmSync(dossier, { recursive: true, force: true })
}

// `format: uuid` : orval le traduit par zod.uuid(), qui exige en zod 4 un UUID
// RFC 9562 (chiffre de version, variante). En JSON Schema 2020-12, `format` est
// une annotation ; la contrainte du contrat est son `pattern` (8-4-4-4-12
// hexadécimal), que le code généré applique déjà par .regex(). zod.guid() est
// la traduction fidèle : un identifiant valide pour le serveur ne doit pas
// produire un faux écart de contrat.
let genere = readFileSync(sortie, "utf8")
const uuids = genere.split("zod.uuid()").length - 1
genere = genere.replaceAll("zod.uuid()", "zod.guid()")
const entete = [
  "// GÉNÉRÉ par tools/contract/generate.mjs (npm run contract:generate). NE PAS MODIFIER.",
  `// Source : contract/openapi.json, copie du serveur au commit ${commit}`,
  `// SHA-256 de la copie : ${empreinte}`,
  "// Lecteur tolérant : additionalProperties:false retiré avant génération (ADR-007).",
  "// format uuid : zod.guid() + pattern du contrat (voir tools/contract/generate.mjs).",
  "",
].join("\n")
writeFileSync(sortie, entete + genere.replace(/\r\n/g, "\n"))
console.log(
  `contract.gen.ts généré (commit ${commit.slice(0, 7)}, ${retires} additionalProperties:false retirés, ${uuids} zod.uuid() → zod.guid()).`,
)
