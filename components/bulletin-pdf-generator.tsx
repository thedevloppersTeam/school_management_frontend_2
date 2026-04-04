// components/bulletin-pdf-generator.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, Download, Eye, Printer } from "lucide-react"
import { toast } from "sonner"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import {
  gradesApi,
  classSubjectsApi,
  enrollmentsApi,
  studentsApi,
  subjectsApi,
  subjectRubricsApi,
} from "@/services/api"
import { parseDecimal, formatDate } from "@/lib/decimal"
import BulletinScolaire, {
  type BulletinData,
  type RubriqueEntry,
  type ComportementItem,
} from "./BulletinScolaire"

// ── Props ─────────────────────────────────────────────────────────────────────

interface BulletinPDFGeneratorProps {
  open:           boolean
  onOpenChange:   (open: boolean) => void
  studentId:      string
  studentName:    string
  classSessionId: string
  stepId:         string
  stepName:       string
  className:      string
  enrollmentId:   string
  onDownload?:    () => void
}

// ── Types locaux ──────────────────────────────────────────────────────────────

interface RubricInfo {
  id:   string
  name: string
  code: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(arr: number[]): number | null {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null
}

function rubriqueAverage(entries: RubriqueEntry[]): number | null {
  // BR-001 : moyenne pondérée des sous-matières (non-parents)
  let total = 0, totalCoeff = 0
  for (const e of entries) {
    if (!e.isParent && e.note !== null && e.note !== undefined && e.coeff) {
      total      += e.note * e.coeff
      totalCoeff += e.coeff
    }
  }
  return totalCoeff > 0 ? total / totalCoeff : null
}

function getAppreciation(moyenne: number): string {
  if (moyenne >= 9.0) return 'A+'
  if (moyenne >= 8.5) return 'A'
  if (moyenne >= 7.8) return 'B+'
  if (moyenne >= 7.5) return 'B'
  if (moyenne >= 6.9) return 'C+'
  if (moyenne >= 6.0) return 'C'
  if (moyenne >= 5.1) return 'D'
  return 'E'
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function BulletinPDFGenerator({
  open,
  onOpenChange,
  studentId,
  studentName,
  classSessionId,
  stepId,
  stepName,
  className,
  enrollmentId,
  onDownload,
}: BulletinPDFGeneratorProps) {
  const [loading,      setLoading]      = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null)
  const [hasFetched,   setHasFetched]   = useState(false)
  const bulletinRef = useRef<HTMLDivElement>(null)

  // ── Construction des données ────────────────────────────────────────────────

  const fetchBulletinData = useCallback(async () => {
    if (!open || hasFetched) return
    setLoading(true)

    try {
      // 1. Élève + matières + rubriques + notes en parallèle
      const [student, classSubjects, rubrics, allGrades] = await Promise.all([
        studentsApi.getById(studentId) as Promise<any>,
        classSubjectsApi.getAll({ classSessionId }),
        subjectRubricsApi.getAll() as Promise<RubricInfo[]>,
        gradesApi.getByEnrollment(enrollmentId, { stepId }),
      ])

      // Map rubricId → code (R1/R2/R3)
      const rubricCodeMap: Record<string, string> = {}
      const rubricNameMap: Record<string, string> = {}
      rubrics.forEach(r => {
        rubricCodeMap[r.id] = r.code
        rubricNameMap[r.id] = r.name
      })

      // Index des notes : classSubjectId → { direct[], sections: Map<sectionId, score[]> }
      const gradeIndex = new Map<string, { direct: number[]; sections: Map<string, number[]> }>()
      for (const grade of allGrades) {
        const score = parseDecimal(grade.studentScore)
        if (score === null) continue
        if (!gradeIndex.has(grade.classSubjectId)) {
          gradeIndex.set(grade.classSubjectId, { direct: [], sections: new Map() })
        }
        const bucket = gradeIndex.get(grade.classSubjectId)!
        if (grade.sectionId) {
          if (!bucket.sections.has(grade.sectionId)) bucket.sections.set(grade.sectionId, [])
          bucket.sections.get(grade.sectionId)!.push(score)
        } else {
          bucket.direct.push(score)
        }
      }

      // Regroupement par rubrique → RubriqueEntry[]
      const r1Entries: RubriqueEntry[] = []
      const r2Entries: RubriqueEntry[] = []
      const r3Entries: RubriqueEntry[] = []

      for (const cs of classSubjects) {
        const subject = await subjectsApi.getById(cs.subjectId) as any
        if (!subject) continue

        const rubricCode = rubricCodeMap[subject.rubricId] ?? ''
        const coeff      = parseDecimal(cs.coefficientOverride) ?? parseDecimal(subject.coefficient) ?? 1
        const bucket     = gradeIndex.get(cs.id)

        let entries: RubriqueEntry[] = []

        if (subject.hasSections) {
          // Matière MENFP = parent (pas de note)
          entries.push({ name: subject.name, isParent: true })

          const sectionsData = await subjectsApi.getSections(subject.id) as any[]
          for (const sec of sectionsData) {
            const secScores = bucket?.sections.get(sec.id) ?? []
            const secNote   = avg(secScores)
            entries.push({
              name:     sec.name,
              note:     secNote !== null ? parseDecimal(secNote) : null,
              coeff:    parseDecimal(sec.coefficient) ?? 1,
              isParent: false,
            })
          }
        } else {
          // Matière directe
          const directNote = avg(bucket?.direct ?? [])
          entries.push({
            name:     subject.name,
            note:     directNote !== null ? parseDecimal(directNote) : null,
            coeff,
            isParent: false,
          })
        }

        if (rubricCode === 'R1') r1Entries.push(...entries)
        else if (rubricCode === 'R2') r2Entries.push(...entries)
        else if (rubricCode === 'R3') r3Entries.push(...entries)
      }

      // Moyennes rubriques
      const moyR1 = rubriqueAverage(r1Entries)
      const moyR2 = rubriqueAverage(r2Entries)
      const moyR3 = rubriqueAverage(r3Entries)

      // Moyenne finale BR-001 : 70% R1 + 25% R2 + 5% R3
      const finalAvg = ((moyR1 ?? 0) * 0.70) + ((moyR2 ?? 0) * 0.25) + ((moyR3 ?? 0) * 0.05)

      // Noms des rubriques depuis l'API
      const r1Name = rubrics.find(r => r.code === 'R1')?.name ?? 'Rubrique 1'
      const r2Name = rubrics.find(r => r.code === 'R2')?.name ?? 'Rubrique 2'
      const r3Name = rubrics.find(r => r.code === 'R3')?.name ?? 'Rubrique 3'

      // Comportement : items vides par défaut (saisie manuelle W5 futur)
      const comportItems: ComportementItem[] = [
        { label: "Manque d'attention",  oui: null, col: 1 },
        { label: "Manque de respect",   oui: null, col: 1 },
        { label: "Indiscipline",        oui: null, col: 1 },
        { label: "Bavardage",           oui: null, col: 2 },
        { label: "Agressivité",         oui: null, col: 2 },
        { label: "Tricherie",           oui: null, col: 2 },
        { label: "Respect uniforme",    oui: null, col: 3 },
        { label: "Discipline générale", oui: null, col: 3 },
        { label: "Participation active",oui: null, col: 3 },
      ]

      setBulletinData({
        // Élève
        prenoms:       student?.user?.firstname ?? studentName.split(' ')[1] ?? '',
        nom:           student?.user?.lastname  ?? studentName.split(' ')[0] ?? '',
        sexe:          student?.user?.gender    ?? '—',
        niveau:        className,
        filiere:       student?.filiere ?? '—',
        dateNaissance: formatDate(student?.user?.birth_date ?? ''),
        anneeScolaire: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        periode:       stepName,
        code:          student?.studentCode ?? '',
        nisu:          student?.nisu ?? '',
        photoUrl:      student?.user?.profilePhoto ?? undefined,

        // Rubriques
        rubrique1Name:  r1Name,
        rubrique1Poids: '70%',
        rubrique1:      r1Entries,
        moyR1,

        rubrique2Name:  r2Name,
        rubrique2Poids: '25%',
        rubrique2:      r2Entries,
        moyR2,

        rubrique3Name:  r3Name,
        rubrique3Poids: '5%',
        rubrique3:      r3Entries,
        moyR3,

        // Résultats
        moyenneEtape:  finalAvg.toFixed(2),
        appreciation:  getAppreciation(finalAvg),
        moyenneClasse: '—',   // TODO : calculer depuis tous les élèves de la classe

        // Comportement
        comportement: {
          absences:        '—',
          retards:         '—',
          devoirsNonRemis: '—',
          leconsNonSues:   '—',
          items:           comportItems,
          pointsForts:     '',
          defis:           '',
          remarque:        '',
        },

        // Établissement (TODO : récupérer en base via API)
        etablissement: {
          nomLigne1: 'Cours Privé Mixte',
          nomLigne2: 'SAINT LÉONARD',
          adresse:   'Delmas, Angle 47 & 41 #10',
          telephone: '2813-1205 / 2264-2081 / 4893-3367',
          email:     'information@stleonard.ht',
          logoUrl:   '/test.jpeg',
        },
      })

      setHasFetched(true)
    } catch (error) {
      console.error('[BulletinPDFGenerator] fetchBulletinData:', error)
      toast.error("Erreur lors de la récupération des données du bulletin")
    } finally {
      setLoading(false)
    }
  }, [open, hasFetched, studentId, enrollmentId, classSessionId, stepId, studentName, className, stepName])

  // ── PDF generation ─────────────────────────────────────────────────────────

  const createPrintableClone = () => {
    if (!bulletinRef.current) return null
    const clone = bulletinRef.current.cloneNode(true) as HTMLElement
    clone.style.height = 'auto'
    clone.style.overflow = 'visible'
    clone.style.maxHeight = 'none'
    clone.querySelectorAll('*').forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.height = 'auto'
        el.style.overflow = 'visible'
        el.style.maxHeight = 'none'
      }
    })
    return clone
  }

  const generatePDFFromHTML = async () => {
    if (!bulletinRef.current) { toast.error("Le bulletin n'est pas encore chargé"); return }
    setGenerating(true)
    try {
      const tempContainer = document.createElement('div')
      tempContainer.style.position = 'absolute'
      tempContainer.style.left = '-9999px'
      tempContainer.style.top = '0'
      tempContainer.style.width = '210mm'
      tempContainer.style.backgroundColor = 'white'
      document.body.appendChild(tempContainer)

      const clone = createPrintableClone()
      if (clone) tempContainer.appendChild(clone)

      await new Promise(resolve => setTimeout(resolve, 300))

      const canvas = await html2canvas(tempContainer, {
        scale: 2, useCORS: true, logging: false,
        backgroundColor: '#ffffff',
        windowWidth: tempContainer.scrollWidth,
        windowHeight: tempContainer.scrollHeight,
      })
      document.body.removeChild(tempContainer)

      const imgData   = canvas.toDataURL('image/png')
      const pdf       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const imgWidth  = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft  = imgHeight
      let position    = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`bulletin_${bulletinData?.nom ?? studentName}_${stepName}.pdf`)
      toast.success("Bulletin téléchargé avec succès")
      if (onDownload) onDownload()
    } catch (error) {
      console.error('[BulletinPDFGenerator] generatePDF:', error)
      toast.error("Erreur lors de la génération du bulletin PDF")
    } finally {
      setGenerating(false)
    }
  }

  // ── Impression ─────────────────────────────────────────────────────────────

  const getStylesHTML = () => {
    let html = ''
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(s => { html += s.outerHTML })
    return html
  }

  const handlePrint = useCallback(() => {
    if (!bulletinRef.current) { toast.error("Le bulletin n'est pas encore chargé"); return }
    const clone = createPrintableClone()
    if (!clone) return
    const w = window.open('', '_blank')
    if (!w) { toast.error("Impossible d'ouvrir la fenêtre d'impression"); return }
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Bulletin de ${studentName} - ${stepName}</title>
      <meta charset="UTF-8">${getStylesHTML()}
      <style>*{overflow:visible!important;height:auto!important;max-height:none!important;}
      body{margin:0;padding:0;background:white;}
      @media print{@page{size:A4;margin:0;}}</style>
    </head><body style="margin:0;padding:0;">${clone.outerHTML}</body></html>`)
    w.document.close()
    w.onload = () => setTimeout(() => { w.print(); w.close() }, 500)
  }, [studentName, stepName])

  // ── Prévisualisation ───────────────────────────────────────────────────────

  const handlePreview = useCallback(() => {
    if (!bulletinRef.current) { toast.error("Le bulletin n'est pas encore chargé"); return }
    const clone = createPrintableClone()
    if (!clone) return
    const w = window.open('', '_blank')
    if (!w) { toast.error("Impossible d'ouvrir la prévisualisation"); return }
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Bulletin de ${studentName} - ${stepName}</title>
      <meta charset="UTF-8">${getStylesHTML()}
      <style>*{overflow:visible!important;height:auto!important;max-height:none!important;}
      body{margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;}
      .bc{background:white;box-shadow:0 0 10px rgba(0,0,0,0.1);margin:0 auto;width:210mm;}
      .pb{position:fixed;bottom:20px;right:20px;padding:12px 24px;background:#2C4A6E;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;z-index:1000;}
      .pb:hover{background:#1e3a5a;}</style>
    </head><body>
      <div class="bc">${clone.outerHTML}</div>
      <button class="pb" onclick="window.print()">🖨️ Imprimer</button>
    </body></html>`)
    w.document.close()
  }, [studentName, stepName])

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open && !hasFetched) fetchBulletinData()
  }, [open, hasFetched, fetchBulletinData])

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) { setHasFetched(false); setBulletinData(null) }
    onOpenChange(newOpen)
  }, [onOpenChange])

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Bulletin de {studentName}</span>
            <span className="text-sm font-normal text-muted-foreground">{className} — {stepName}</span>
          </DialogTitle>
          <DialogDescription>Consultez et générez le bulletin de l&apos;élève</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : bulletinData ? (
            <div ref={bulletinRef} style={{ backgroundColor: 'white', borderRadius: '8px' }}>
              <BulletinScolaire data={bulletinData} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground">Aucune donnée disponible</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            {bulletinData && !generating && (
              <>
                <Button onClick={generatePDFFromHTML} style={{ backgroundColor: '#2C4A6E', color: 'white' }} disabled={generating}>
                  <Download className="mr-2 h-4 w-4" /> Télécharger PDF
                </Button>
                <Button variant="outline" onClick={handlePreview} disabled={generating}>
                  <Eye className="mr-2 h-4 w-4" /> Prévisualiser
                </Button>
                <Button variant="outline" onClick={handlePrint} disabled={generating}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimer
                </Button>
              </>
            )}
            {generating && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Génération en cours...
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}