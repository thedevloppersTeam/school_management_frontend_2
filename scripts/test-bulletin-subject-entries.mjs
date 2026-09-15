import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../lib/bulletin-subject-entries.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText

const commonJsModule = { exports: {} }
vm.runInNewContext(compiled, {
  exports: commonJsModule.exports,
  module: commonJsModule,
  require,
  console,
})

const { buildSubjectEntries } = commonJsModule.exports

const sectionedSubject = {
  name: 'Sciences Experimentales',
  maxScore: 60,
  hasSections: true,
  sections: [
    { id: 'technology', name: 'Education a la Technologie', maxScore: 20 },
    { id: 'health', name: 'Education a la Sante', maxScore: 20 },
    { id: 'environment', name: 'Education a l Environnement', maxScore: 20 },
    { id: 'etap', name: 'ETAP', maxScore: 20 },
  ],
}

{
  const entries = buildSubjectEntries(sectionedSubject, {
    direct: [],
    sections: new Map([
      ['technology', [0]],
      ['health', [9.25]],
      ['etap', [7.75]],
    ]),
  })

  assert.equal(entries.length, 5)
  assert.equal(entries[0].isParent, true)
  assert.match(entries[0].warning, /matiere \/60, sections \/80/)
  assert.equal(entries[1].note, 0)
  assert.equal(entries[1].coeff, 20)
  assert.equal(entries[2].note, 9.25)
  assert.equal(entries[3].note, null)
  assert.equal(entries[3].coeff, undefined)
  assert.equal(entries[4].note, 7.75)
}

{
  const entries = buildSubjectEntries(sectionedSubject, undefined)
  assert.equal(entries.length, 5)
  assert.equal(entries[0].name, 'Sciences Experimentales')
  assert.equal(entries[1].name, 'Education a la Technologie')
  assert.equal(entries[1].note, null)
}

{
  const entries = buildSubjectEntries(sectionedSubject, {
    direct: [12.5],
    sections: new Map(),
  })
  assert.equal(entries.length, 6)
  assert.equal(entries[1].name, 'Note globale')
  assert.equal(entries[1].note, 12.5)
  assert.equal(entries[1].coeff, 60)
  assert.equal(entries[2].name, 'Education a la Technologie')
}

{
  const entries = buildSubjectEntries({
    name: 'Mathematiques',
    maxScore: 20,
    hasSections: false,
    sections: [],
  }, {
    direct: [0],
    sections: new Map(),
  })

  assert.equal(entries.length, 1)
  assert.equal(entries[0].note, 0)
  assert.equal(entries[0].coeff, 20)
}

console.log('bulletin subject entry tests passed')
