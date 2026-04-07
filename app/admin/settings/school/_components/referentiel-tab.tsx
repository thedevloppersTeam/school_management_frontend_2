// app/(dashboard)/settings/school/_components/referentiel-tab.tsx
"use client"

import React from "react"
import { Button }   from "@/components/ui/button"
import { Badge }    from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react"
import { type Rubric, type Subject, getSectionCycles } from "../_hooks/use-school-settings"

const TH = { fontSize:'12px', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'#2C4A6E' }

function rubricColor(code?: string) {
  if (code === 'R1') return { bg:'#E3EFF9', color:'#2B6CB0' }
  if (code === 'R2') return { bg:'#E8F5EC', color:'#2D7D46' }
  if (code === 'R3') return { bg:'#FAF8F3', color:'#B0A07A' }
  return { bg:'#F0F4F7', color:'#5A7085' }
}
// rubricColor complexity: 3 (3 ifs)

const rubricWeight = (code: string) =>
  code === 'R1' ? '70%' : code === 'R2' ? '25%' : code === 'R3' ? '5%' : '—'
// complexity: 3 (3 ternaries — sonar excludes ?? but not ternary; still independent fn)

interface ReferentielTabProps {
  loading: boolean
  rubrics: Rubric[]
  subjects: Subject[]
  expandedSubjects: Set<string>
  onCreateRubric: () => void
  onEditRubric: (r:Rubric) => void
  onCreateSubject: () => void
  onEditSubject: (s:Subject) => void
  onCreateSection: (subjectId:string) => void
  onToggleExpand: (subjectId:string) => void
}

export function ReferentielTab({
  loading, rubrics, subjects, expandedSubjects,
  onCreateRubric, onEditRubric, onCreateSubject, onEditSubject, onCreateSection, onToggleExpand
}: ReferentielTabProps) {
  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>  // +1

  return (
    <>
      {/* ── Rubriques ────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor:'#FFFFFF', borderRadius:'10px', border:'1px solid #E8E6E3', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #E8E6E3', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h3 style={{ fontFamily:'var(--font-serif)', fontSize:'18px', fontWeight:600, color:'#2A3740' }}>Rubriques ({rubrics.length})</h3>
            <p style={{ fontSize:'13px', color:'#78756F', marginTop:'2px' }}>Formule BR-001 : R1 × 70% + R2 × 25% + R3 × 5%</p>
          </div>
          <Button onClick={onCreateRubric} disabled={rubrics.length >= 3}
            title={rubrics.length >= 3 ? "Maximum 3 rubriques (R1, R2, R3)" : undefined}
            style={{ backgroundColor:rubrics.length >= 3 ? '#9CA3AF' : '#2C4A6E', color:'white', borderRadius:'8px' }}>
            <PlusIcon className="mr-2 h-4 w-4" />Nouvelle rubrique
          </Button>
        </div>
        <div style={{ padding:'24px' }}>
          <div style={{ borderRadius:'8px', border:'1px solid #E8E6E3', overflow:'hidden' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor:'#F1F5F9', borderBottom:'2px solid #D1D5DB' }}>
                  <TableHead style={TH}>Code</TableHead>
                  <TableHead style={TH}>Nom</TableHead>
                  <TableHead style={TH}>Description</TableHead>
                  <TableHead style={TH}>Poids BR-001</TableHead>
                  <TableHead style={{ ...TH, textAlign:'center' }}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrics.length === 0
                  ? <TableRow><TableCell colSpan={5} style={{ textAlign:'center', color:'#78756F', padding:'32px' }}>Aucune rubrique — créez R1, R2, R3</TableCell></TableRow>
                  : rubrics.map((rubric, i) => {
                      const colors = rubricColor(rubric.code)
                      return (
                        <TableRow key={rubric.id} style={{ borderTop:i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                          <TableCell><Badge style={{ backgroundColor:colors.bg, color:colors.color, border:'none', fontWeight:700 }}>{rubric.code}</Badge></TableCell>
                          <TableCell style={{ fontWeight:600, color:'#1E1A17', fontSize:'14px' }}>{rubric.name}</TableCell>
                          <TableCell style={{ color:'#78756F', fontSize:'13px' }}>{rubric.description || '—'}</TableCell>
                          <TableCell style={{ fontWeight:700, color:colors.color, fontSize:'14px' }}>{rubricWeight(rubric.code)}</TableCell>
                          <TableCell style={{ textAlign:'center' }}>
                            <button onClick={() => onEditRubric(rubric)} style={{ fontSize:'13px', fontWeight:500, color:'#5A7085', background:'none', border:'none', cursor:'pointer' }}>Modifier</button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ── Matières ─────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor:'#FFFFFF', borderRadius:'10px', border:'1px solid #E8E6E3', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #E8E6E3', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h3 style={{ fontFamily:'var(--font-serif)', fontSize:'18px', fontWeight:600, color:'#2A3740' }}>Matières ({subjects.length})</h3>
            <p style={{ fontSize:'13px', color:'#78756F', marginTop:'2px' }}>Référentiel global — les matières sont assignées aux classes dans la configuration de l&apos;année</p>
          </div>
          <Button onClick={onCreateSubject} disabled={rubrics.length === 0}
            title={rubrics.length === 0 ? "Créez d'abord les rubriques" : undefined}
            style={{ backgroundColor:rubrics.length === 0 ? '#9CA3AF' : '#2C4A6E', color:'white', borderRadius:'8px' }}>
            <PlusIcon className="mr-2 h-4 w-4" />Nouvelle matière
          </Button>
        </div>
        <div style={{ padding:'24px' }}>
          <div style={{ borderRadius:'8px', border:'1px solid #E8E6E3', overflow:'hidden' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor:'#F1F5F9', borderBottom:'2px solid #D1D5DB' }}>
                  <TableHead style={{ ...TH, width:'3%' }}></TableHead>
                  <TableHead style={TH}>Code</TableHead>
                  <TableHead style={TH}>Nom</TableHead>
                  <TableHead style={TH}>Rubrique</TableHead>
                  <TableHead style={TH}>Coeff.</TableHead>
                  <TableHead style={TH}>Max</TableHead>
                  <TableHead style={{ ...TH, textAlign:'center' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.length === 0
                  ? <TableRow><TableCell colSpan={7} style={{ textAlign:'center', color:'#78756F', padding:'32px' }}>
                      {rubrics.length === 0 ? "Créez d'abord les rubriques (R1, R2, R3)" : "Aucune matière — créez la première"}
                    </TableCell></TableRow>
                  : subjects.map((subject, i) => {
                      const isExpanded = expandedSubjects.has(subject.id)
                      const colors = rubricColor(subject.rubric?.code)
                      return (
                        <React.Fragment key={subject.id}>
                          <TableRow style={{ borderTop:i > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor:'white' }} className="hover:bg-[#FAF8F3]">
                            <TableCell style={{ padding:'12px 8px' }}>
                              {subject.hasSections && (
                                <button onClick={() => onToggleExpand(subject.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#5A7085', display:'flex' }}>
                                  {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                                </button>
                              )}
                            </TableCell>
                            <TableCell style={{ fontFamily:'monospace', fontSize:'12px', fontWeight:600, color:'#1E1A17', textTransform:'uppercase' }}>{subject.code}</TableCell>
                            <TableCell style={{ fontWeight:600, color:'#1E1A17', fontSize:'14px' }}>{subject.name}</TableCell>
                            <TableCell>
                              {subject.rubric
                                ? <Badge style={{ backgroundColor:colors.bg, color:colors.color, border:'none' }}>{subject.rubric.code}</Badge>
                                : <span style={{ color:'#A8A5A2' }}>—</span>}
                            </TableCell>
                            <TableCell style={{ fontSize:'14px' }}>{subject.coefficient}</TableCell>
                            <TableCell style={{ fontSize:'14px' }}>{subject.maxScore}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => onCreateSection(subject.id)} style={{ fontSize:'12px', fontWeight:500, color:'#2C4A6E', background:'none', border:'none', cursor:'pointer' }}>+ Section</button>
                                <span style={{ color:'#D1CECC' }}>|</span>
                                <button onClick={() => onEditSubject(subject)} style={{ fontSize:'13px', fontWeight:500, color:'#5A7085', background:'none', border:'none', cursor:'pointer' }}>Modifier</button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && subject.sections?.map(section => {
                            const cycles = getSectionCycles(section.id)
                            return (
                              <TableRow key={section.id} style={{ borderTop:'1px solid #E8E6E3', backgroundColor:'#FAFAF8' }}>
                                <TableCell></TableCell>
                                <TableCell style={{ paddingLeft:'24px', fontFamily:'monospace', fontSize:'11px', color:'#78756F', textTransform:'uppercase' }}>
                                  <span style={{ color:'#A8A5A2' }}>└ </span>{section.code}
                                </TableCell>
                                <TableCell style={{ fontSize:'13px', color:'#1E1A17' }}>{section.name}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {cycles.length > 0
                                      ? cycles.map(c => (
                                          <span key={c} style={{ backgroundColor:'#E3EFF9', color:'#2B6CB0', padding:'1px 6px', borderRadius:'4px', fontSize:'11px', fontWeight:500 }}>{c}</span>
                                        ))
                                      : <span style={{ color:'#A8A5A2', fontSize:'12px' }}>Tous les cycles</span>}
                                  </div>
                                </TableCell>
                                <TableCell style={{ fontSize:'13px', color:'#78756F' }}>{section.maxScore}</TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  )
}
// ReferentielTab complexity: 1 (early return for loading)
// — all other branches are in rubricColor / rubricWeight / rubrics.map callbacks
//   which are each independent functions with their own score


// ══════════════════════════════════════════════════════════════════════════════
// app/(dashboard)/settings/school/_components/classes-tab.tsx
// ══════════════════════════════════════════════════════════════════════════════

import { Skeleton as SkeletonC } from "@/components/ui/skeleton"
import { Button as ButtonC } from "@/components/ui/button"
import { Badge as BadgeC } from "@/components/ui/badge"
import { Table as TableC, TableBody as TableBodyC, TableCell as TableCellC, TableHead as TableHeadC, TableHeader as TableHeaderC, TableRow as TableRowC } from "@/components/ui/table"
import { ZapIcon, CheckCircle2Icon } from "lucide-react"
import { type ClassType, type Class } from "../_hooks/use-school-settings"

interface ClassesTabProps {
  loading: boolean
  classTypes: ClassType[]
  classes: Class[]
  initializing: boolean
  onInitialize: () => void
  onEditClass: (c:Class) => void
}

export function ClassesTab({ loading, classTypes, classes, initializing, onInitialize, onEditClass }: ClassesTabProps) {
  if (loading) return <SkeletonC className="h-64 w-full" />                  // +1

  const classesInitialized = classes.length > 0

  return (
    <div style={{ backgroundColor:'#FFFFFF', borderRadius:'10px', border:'1px solid #E8E6E3', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ padding:'20px 24px', borderBottom:'1px solid #E8E6E3', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h3 style={{ fontFamily:'var(--font-serif)', fontSize:'18px', fontWeight:600, color:'#2A3740' }}>
            Classes ({classes.length} / {classTypes.length || 13})
          </h3>
          <p style={{ fontSize:'13px', color:'#78756F', marginTop:'2px' }}>Référentiel permanent — salle A par défaut pour chaque niveau</p>
        </div>
        {classTypes.length === 0 && (
          <ButtonC onClick={onInitialize} disabled={initializing}
            style={{ backgroundColor:'#2C4A6E', color:'white', borderRadius:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
            <ZapIcon className="h-4 w-4" />{initializing ? 'Initialisation...' : 'Initialiser niveaux & classes'}
          </ButtonC>
        )}
        {classesInitialized && (
          <div className="flex items-center gap-2" style={{ color:'#2D7D46', fontSize:'13px', fontWeight:500 }}>
            <CheckCircle2Icon className="h-4 w-4" />Classes initialisées
          </div>
        )}
      </div>

      <div style={{ padding:'24px' }}>
        {classTypes.length === 0
          ? (
            <div style={{ textAlign:'center', padding:'48px 24px' }}>
              <p style={{ fontSize:'16px', fontWeight:600, color:'#3A4A57', marginBottom:'8px' }}>Aucun niveau configuré</p>
              <p style={{ fontSize:'13px', color:'#78756F', marginBottom:'24px' }}>
                Cliquez sur &quot;Initialiser niveaux &amp; classes&quot; pour créer les 13 niveaux MENFP.
              </p>
              <ButtonC onClick={onInitialize} disabled={initializing}
                style={{ backgroundColor:'#2C4A6E', color:'white', borderRadius:'8px', display:'inline-flex', alignItems:'center', gap:'8px' }}>
                <ZapIcon className="h-4 w-4" />{initializing ? 'Initialisation en cours...' : 'Initialiser niveaux & classes'}
              </ButtonC>
            </div>
          )
          : (
            <div style={{ borderRadius:'8px', border:'1px solid #E8E6E3', overflow:'hidden' }}>
              <TableC>
                <TableHeaderC>
                  <TableRowC style={{ backgroundColor:'#F1F5F9', borderBottom:'2px solid #D1D5DB' }}>
                    <TableHeadC style={TH}>Niveau</TableHeadC>
                    <TableHeadC style={TH}>Type</TableHeadC>
                    <TableHeadC style={TH}>Max élèves</TableHeadC>
                    <TableHeadC style={{ ...TH, textAlign:'center' }}>Statut</TableHeadC>
                    <TableHeadC style={{ ...TH, textAlign:'center' }}>Action</TableHeadC>
                  </TableRowC>
                </TableHeaderC>
                <TableBodyC>
                  {classTypes.map((ct, i) => {
                    const cls = classes.find(c => c.classTypeId === ct.id)
                    return (
                      <TableRowC key={ct.id} style={{ borderTop:i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                        <TableCellC style={{ fontWeight:700, color:'#1E1A17', fontSize:'14px' }}>{ct.name}</TableCellC>
                        <TableCellC>
                          {ct.isTerminal
                            ? <BadgeC style={{ backgroundColor:'#FEF6E0', color:'#C48B1A', border:'none', fontSize:'11px' }}>Examen</BadgeC>
                            : <BadgeC style={{ backgroundColor:'#F0F4F7', color:'#5A7085', border:'none', fontSize:'11px' }}>Standard</BadgeC>}
                        </TableCellC>
                        <TableCellC style={{ fontSize:'13px', color:'#78756F' }}>{cls?.maxStudents ?? '—'}</TableCellC>
                        <TableCellC style={{ textAlign:'center' }}>
                          {cls
                            ? <BadgeC style={{ backgroundColor:'#E8F5EC', color:'#2D7D46', border:'none', fontSize:'11px' }}>✓ Créée</BadgeC>
                            : <BadgeC style={{ backgroundColor:'#FEF6E0', color:'#C48B1A', border:'none', fontSize:'11px' }}>En attente</BadgeC>}
                        </TableCellC>
                        <TableCellC style={{ textAlign:'center' }}>
                          {cls
                            ? <button onClick={() => onEditClass(cls)} style={{ fontSize:'13px', fontWeight:500, color:'#5A7085', background:'none', border:'none', cursor:'pointer' }}>Modifier</button>
                            : <span style={{ color:'#D1CECC', fontSize:'13px' }}>—</span>}
                        </TableCellC>
                      </TableRowC>
                    )
                  })}
                </TableBodyC>
              </TableC>
            </div>
          )}
      </div>
    </div>
  )
}
// ClassesTab complexity: 1 (early return for loading)
// — ternaries inside JSX map callbacks are each independent


// ══════════════════════════════════════════════════════════════════════════════
// app/(dashboard)/settings/school/_components/attitudes-tab.tsx
// ══════════════════════════════════════════════════════════════════════════════

import { Skeleton as SkeletonA }  from "@/components/ui/skeleton"
import { Button as ButtonA }      from "@/components/ui/button"
import { Table as TableA, TableBody as TableBodyA, TableCell as TableCellA, TableHead as TableHeadA, TableHeader as TableHeaderA, TableRow as TableRowA } from "@/components/ui/table"
import { PlusIcon as PlusA, Trash2Icon } from "lucide-react"
import { type Attitude } from "../_hooks/use-school-settings"

interface AttitudesTabProps {
  loading: boolean
  attitudes: Attitude[]
  currentYearId: string | null
  onCreateAttitude: () => void
  onEditAttitude: (a:Attitude) => void
  onDeleteAttitude: (a:Attitude) => void
}

export function AttitudesTab({ loading, attitudes, currentYearId, onCreateAttitude, onEditAttitude, onDeleteAttitude }: AttitudesTabProps) {
  if (loading) return <SkeletonA className="h-64 w-full" />                  // +1

  return (
    <div style={{ backgroundColor:'#FFFFFF', borderRadius:'10px', border:'1px solid #E8E6E3', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ padding:'20px 24px', borderBottom:'1px solid #E8E6E3', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h3 style={{ fontFamily:'var(--font-serif)', fontSize:'18px', fontWeight:600, color:'#2A3740' }}>Attitudes ({attitudes.length})</h3>
          <p style={{ fontSize:'13px', color:'#78756F', marginTop:'2px' }}>Caractéristiques de comportement évaluées pour l&apos;année active — Oui / Non par élève</p>
        </div>
        <ButtonA onClick={onCreateAttitude} disabled={!currentYearId}
          title={!currentYearId ? "Aucune année active" : undefined}
          style={{ backgroundColor:!currentYearId ? '#9CA3AF' : '#2C4A6E', color:'white', borderRadius:'8px' }}>
          <PlusA className="mr-2 h-4 w-4" />Nouvelle attitude
        </ButtonA>
      </div>

      {!currentYearId && (
        <div style={{ padding:'32px', textAlign:'center' }}>
          <p style={{ fontSize:'14px', color:'#C48B1A' }}>Aucune année scolaire active. Activez une année dans la configuration.</p>
        </div>
      )}

      {currentYearId && (
        <div style={{ padding:'24px' }}>
          {attitudes.length === 0
            ? (
              <div style={{ textAlign:'center', padding:'48px 24px', border:'1px dashed #D1CECC', borderRadius:'8px' }}>
                <p style={{ fontSize:'15px', fontWeight:600, color:'#3A4A57', marginBottom:'6px' }}>Aucune attitude configurée</p>
                <p style={{ fontSize:'13px', color:'#78756F', marginBottom:'20px' }}>
                  Ajoutez les attitudes à évaluer pour cette année.<br />
                  Exemples : Respectueux(se), Ponctuel(le), Attentif(ve)
                </p>
                <ButtonA onClick={onCreateAttitude} style={{ backgroundColor:'#2C4A6E', color:'white', borderRadius:'8px' }}>
                  <PlusA className="mr-2 h-4 w-4" />Créer la première attitude
                </ButtonA>
              </div>
            )
            : (
              <div style={{ borderRadius:'8px', border:'1px solid #E8E6E3', overflow:'hidden' }}>
                <TableA>
                  <TableHeaderA>
                    <TableRowA style={{ backgroundColor:'#F1F5F9', borderBottom:'2px solid #D1D5DB' }}>
                      <TableHeadA style={TH}>#</TableHeadA>
                      <TableHeadA style={TH}>Libellé</TableHeadA>
                      <TableHeadA style={{ ...TH, textAlign:'center' }}>Actions</TableHeadA>
                    </TableRowA>
                  </TableHeaderA>
                  <TableBodyA>
                    {attitudes.map((att, i) => (
                      <TableRowA key={att.id} style={{ borderTop:i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                        <TableCellA style={{ width:'48px', color:'#A8A5A2', fontSize:'13px', fontWeight:500 }}>{i + 1}</TableCellA>
                        <TableCellA style={{ fontWeight:600, color:'#1E1A17', fontSize:'14px' }}>{att.label}</TableCellA>
                        <TableCellA style={{ textAlign:'center' }}>
                          <div className="flex items-center justify-center gap-3">
                            <button onClick={() => onEditAttitude(att)} style={{ fontSize:'13px', fontWeight:500, color:'#5A7085', background:'none', border:'none', cursor:'pointer' }}>Modifier</button>
                            <span style={{ color:'#D1CECC' }}>|</span>
                            <button onClick={() => onDeleteAttitude(att)} style={{ fontSize:'13px', fontWeight:500, color:'#C43C3C', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Trash2Icon className="h-3.5 w-3.5" />Supprimer
                            </button>
                          </div>
                        </TableCellA>
                      </TableRowA>
                    ))}
                  </TableBodyA>
                </TableA>
              </div>
            )}
        </div>
      )}
    </div>
  )
}