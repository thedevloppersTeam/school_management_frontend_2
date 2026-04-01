// components/school/bulletin-pdf-generator.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, Download, Eye, Printer, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { 
  reportsApi, 
  gradesApi, 
  classSubjectsApi, 
  enrollmentsApi, 
  studentsApi,
  subjectsApi,
  subjectRubricsApi
} from "@/services/api"
import { parseDecimal, formatDate } from "@/lib/decimal"
import BulletinScolaire, { BulletinData, Subject } from "./BulletinScolaire"

interface BulletinPDFGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  studentName: string
  classSessionId: string
  stepId: string
  stepName: string
  className: string
  enrollmentId: string
  onDownload?: () => void
}

interface RubricInfo {
  id: string
  name: string
  code: string
  description?: string
}

interface SectionInfo {
  id: string
  name: string
  code: string
  maxScore: number
  parentId: string
  average: number | null
  grades: number[]
}

interface SubjectWithRubric {
  classSubjectId: string
  subjectId: string
  name: string
  code: string
  coefficient: number
  maxScore: number
  hasSections: boolean
  rubricId?: string
  rubricCode?: string
  rubricName?: string
  sections: SectionInfo[]
  directGrades: number[]
  average: number | null
}

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
  onDownload
}: BulletinPDFGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null)
  const [hasFetched, setHasFetched] = useState(false)
  const bulletinRef = useRef<HTMLDivElement>(null)

  const fetchBulletinData = useCallback(async () => {
    if (!open || hasFetched) return
    
    setLoading(true)
    try {
      // 1. Récupérer les données de l'étudiant
      const student = await studentsApi.getById(studentId) as any

      console.log("Fetched student data:", student) // Debug log
      
      // 2. Récupérer les matières de la classe
      const classSubjects = await classSubjectsApi.getAll({ classSessionId })
      
      // 3. Récupérer TOUTES les rubriques
      const rubrics = await subjectRubricsApi.getAll() as RubricInfo[]
      
      // 4. Récupérer les informations détaillées des matières (subjects)
      const subjectsMap = new Map<string, any>()
      for (const cs of classSubjects) {
        const subject = await subjectsApi.getById(cs.subjectId)
        subjectsMap.set(cs.subjectId, subject)
      }
      
      // 5. Récupérer TOUTES les notes pour cette étape pour cet élève
      const allGrades = await gradesApi.getByEnrollment(enrollmentId, { stepId })
      
      // 6. Organiser les notes par classSubjectId
      const gradesByClassSubject = new Map<string, { direct: number[], sections: Map<string, number[]> }>()
      
      for (const grade of allGrades) {
        const rawScore = parseDecimal(grade.studentScore)
        if (rawScore !== null) {
          if (!gradesByClassSubject.has(grade.classSubjectId)) {
            gradesByClassSubject.set(grade.classSubjectId, {
              direct: [],
              sections: new Map()
            })
          }
          
          const subjectGrades = gradesByClassSubject.get(grade.classSubjectId)!
          
          if (grade.sectionId) {
            if (!subjectGrades.sections.has(grade.sectionId)) {
              subjectGrades.sections.set(grade.sectionId, [])
            }
            subjectGrades.sections.get(grade.sectionId)!.push(rawScore)
          } else {
            subjectGrades.direct.push(rawScore)
          }
        }
      }
      
      // 7. Construire la liste des matières
      const subjectsWithRubric: SubjectWithRubric[] = []
      
      for (const cs of classSubjects) {
        const subject = subjectsMap.get(cs.subjectId)
        const subjectGrades = gradesByClassSubject.get(cs.id)
        const rubric = rubrics.find(r => r.id === subject?.rubricId)
        
        const directGrades = subjectGrades?.direct || []
        
        let sections: SectionInfo[] = []
        if (subject?.hasSections) {
          const sectionsData = await subjectsApi.getSections(subject.id)
          sections = sectionsData.map(section => {
            const sectionGrades = subjectGrades?.sections.get(section.id) || []
            const sectionAverage = sectionGrades.length > 0
              ? sectionGrades.reduce((sum, s) => sum + s, 0) / sectionGrades.length
              : null
            return {
              id: section.id,
              name: section.name,
              code: section.code,
              maxScore: parseDecimal(section.maxScore) || 100,
              parentId: subject.id,
              average: sectionAverage,
              grades: sectionGrades
            }
          })
        }
        
        let average: number | null = null
        if (subject?.hasSections && sections.length > 0) {
          const validSectionAverages = sections.filter(s => s.average !== null).map(s => s.average as number)
          if (validSectionAverages.length > 0) {
            average = validSectionAverages.reduce((sum, s) => sum + s, 0) / validSectionAverages.length
          }
        } else if (directGrades.length > 0) {
          average = directGrades.reduce((sum, s) => sum + s, 0) / directGrades.length
        }
        
        subjectsWithRubric.push({
          classSubjectId: cs.id,
          subjectId: cs.subjectId,
          name: subject?.name || '',
          code: subject?.code || '',
          coefficient: (cs.coefficientOverride 
            ? parseDecimal(cs.coefficientOverride) 
            : parseDecimal(subject?.coefficient)) ?? 1,
          maxScore: parseDecimal(subject?.maxScore) || 20,
          hasSections: subject?.hasSections || false,
          rubricId: subject?.rubricId,
          rubricCode: rubric?.code,
          rubricName: rubric?.name,
          sections: sections,
          directGrades: directGrades,
          average: average
        })
      }
      
      // 8. Organiser les matières par rubrique
      const rubriquesMap = new Map<string, Subject[]>()
      
      for (const rubric of rubrics) {
        rubriquesMap.set(rubric.id, [])
      }
      
      for (const subject of subjectsWithRubric) {
        const noteToDisplay = subject.average !== null ? subject.average : null
        
        const subjectDisplay: Subject = {
          name: subject.name,
          notes: noteToDisplay !== null ? noteToDisplay.toFixed(2) : '-',
          coeff: subject.coefficient.toString(),
          isCategoryHeader: subject.hasSections && subject.sections.length > 0
        }
        
        const sectionsDisplay: Subject[] = (subject.sections || []).map(section => ({
          name: section.name,
          notes: section.average !== null ? section.average.toFixed(2) : '-',
          coeff: (subject.coefficient / Math.max(1, subject.sections.length)).toFixed(1),
          isSection: true
        }))
        
        const rubricKey = subject.rubricId || 'unknown'
        if (!rubriquesMap.has(rubricKey)) {
          rubriquesMap.set(rubricKey, [])
        }
        
        const rubricSubjects = rubriquesMap.get(rubricKey)!
        rubricSubjects.push(subjectDisplay)
        if (sectionsDisplay.length > 0) {
          rubricSubjects.push(...sectionsDisplay)
        }
      }
      
      // 9. Calculer les moyennes des rubriques
      const calculateRubriqueAverage = (subjects: Subject[]) => {
        let total = 0
        let totalCoeff = 0
        for (const subject of subjects) {
          if (!subject.isCategoryHeader && !subject.isSection && !subject.isMoyenne && !subject.isTotal && subject.notes !== '-') {
            const note = parseFloat(subject.notes || '0')
            const coeff = parseFloat(subject.coeff || '0')
            if (!isNaN(note) && !isNaN(coeff) && coeff > 0) {
              total += note * coeff
              totalCoeff += coeff
            }
          }
        }
        return totalCoeff > 0 ? total / totalCoeff : 0
      }
      
      const getSCI = rubriquesMap.get(rubrics.find(r => r.code === 'R1')?.id || '') || []
      const getLNG = rubriquesMap.get(rubrics.find(r => r.code === 'R2')?.id || '') || []
      const getHUM = rubriquesMap.get(rubrics.find(r => r.code === 'R3')?.id || '') || []
      
      const avg1 = calculateRubriqueAverage(getSCI)
      const avg2 = calculateRubriqueAverage(getLNG)
      const avg3 = calculateRubriqueAverage(getHUM)
      
      const addTotalAndAverage = (subjects: Subject[]) => {
        if (subjects.length > 0) {
          const totalCoeff = subjects
            .filter(s => !s.isCategoryHeader && !s.isSection && !s.isMoyenne && !s.isTotal && s.coeff)
            .reduce((sum, s) => sum + parseFloat(s.coeff || '0'), 0)
          
          subjects.push({ name: "", notes: "-", coeff: totalCoeff.toString(), isTotal: true })
          subjects.push({ name: "Moyenne sur 10", isMoyenne: true })
        }
      }
      
      addTotalAndAverage(getSCI)
      addTotalAndAverage(getLNG)
      addTotalAndAverage(getHUM)
      
      const finalAverage = (avg1 * 70 + avg2 * 25 + avg3 * 5) / 100
      
      let appreciation = 'E'
      if (finalAverage >= 9) appreciation = 'A+'
      else if (finalAverage >= 8.5) appreciation = 'A'
      else if (finalAverage >= 7.8) appreciation = 'B+'
      else if (finalAverage >= 7.5) appreciation = 'B'
      else if (finalAverage >= 6.9) appreciation = 'C+'
      else if (finalAverage >= 6) appreciation = 'C'
      else if (finalAverage >= 5.1) appreciation = 'D'
      else appreciation = 'E'
      
      setBulletinData({
        prenoms: student?.user?.firstname || studentName.split(' ')[1] || '',
        nom: student?.user?.lastname || studentName.split(' ')[0] || '',
        niveau: className.split(' ')[0] || 'Terminale',
        filiere: className.includes('SMP') ? 'SMP' : className.includes('SVT') ? 'SVT' : '—',
        periode: stepName,
        dateNaissance: formatDate(student?.user?.birth_date),
        anneeScolaire: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
        code: student?.studentCode || '',
        nisu: student?.nisu || '',
        moyenneEtape: finalAverage.toFixed(2),
        appreciation: appreciation,
        moyenneClasse: "10.50",
        rubrique1: getSCI,
        rubrique1Name: rubrics.find(r => r.code === 'SCI')?.name || 'Rubrique 1',
        rubrique2: getLNG,
        rubrique2Name: rubrics.find(r => r.code === 'LNG')?.name || 'Rubrique 2',
        rubrique3: getHUM,
        rubrique3Name: rubrics.find(r => r.code === 'HUM')?.name || 'Rubrique 3',
        comportement: {
          absences: "-",
          retards: "-",
          devoirsNonRemis: "-",
          leconsNonSues: "-",
          comportements: [],
          pointsForts: "",
          defis: "",
          remarque: "",
        }
      })
      
      setHasFetched(true)
    } catch (error) {
      console.error("Error fetching bulletin data:", error)
      toast.error("Erreur lors de la récupération des données")
    } finally {
      setLoading(false)
    }
  }, [open, hasFetched, studentId, enrollmentId, classSessionId, stepId, studentName, className, stepName])

  // Créer un clone du bulletin sans contraintes de scroll pour l'impression
  const createPrintableClone = () => {
    if (!bulletinRef.current) return null
    
    // Cloner le contenu
    const originalElement = bulletinRef.current
    const clone = originalElement.cloneNode(true) as HTMLElement
    
    // Supprimer toutes les contraintes de hauteur et overflow
    clone.style.height = 'auto'
    clone.style.overflow = 'visible'
    clone.style.maxHeight = 'none'
    
    // S'assurer que tous les éléments internes sont visibles
    const allElements = clone.querySelectorAll('*')
    allElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.height = 'auto'
        el.style.overflow = 'visible'
        el.style.maxHeight = 'none'
      }
    })
    
    return clone
  }

  // Générer le PDF à partir du HTML (sans scroll bar)
  const generatePDFFromHTML = async () => {
    if (!bulletinRef.current) {
      toast.error("Le bulletin n'est pas encore chargé")
      return
    }

    setGenerating(true)
    
    try {
      // Créer un conteneur temporaire pour le rendu
      const tempContainer = document.createElement('div')
      tempContainer.style.position = 'absolute'
      tempContainer.style.left = '-9999px'
      tempContainer.style.top = '0'
      tempContainer.style.width = '210mm'
      tempContainer.style.backgroundColor = 'white'
      document.body.appendChild(tempContainer)
      
      // Cloner le contenu sans contraintes
      const clone = createPrintableClone()
      if (clone) {
        tempContainer.appendChild(clone)
      }
      
      // Attendre que le contenu soit rendu
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Capturer le contenu
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: tempContainer.scrollWidth,
        windowHeight: tempContainer.scrollHeight
      })
      
      // Nettoyer le conteneur temporaire
      document.body.removeChild(tempContainer)
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      pdf.save(`bulletin_${bulletinData?.nom || studentName}_${stepName}.pdf`)
      
      toast.success("Bulletin téléchargé avec succès")
      if (onDownload) onDownload()
      
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error)
      toast.error("Erreur lors de la génération du bulletin PDF")
    } finally {
      setGenerating(false)
    }
  }

  // Imprimer le bulletin (sans scroll bar)
  const handlePrint = useCallback(() => {
    if (!bulletinRef.current) {
      toast.error("Le bulletin n'est pas encore chargé")
      return
    }

    // Créer un clone sans contraintes
    const clone = createPrintableClone()
    if (!clone) return
    
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]')
    let stylesHTML = ''
    
    styles.forEach(style => {
      if (style.tagName === 'STYLE') {
        stylesHTML += style.outerHTML
      } else if (style.tagName === 'LINK') {
        stylesHTML += style.outerHTML
      }
    })
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression")
      return
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bulletin de ${studentName} - ${stepName}</title>
          <meta charset="UTF-8">
          ${stylesHTML}
          <style>
            * {
              overflow: visible !important;
              height: auto !important;
              max-height: none !important;
            }
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              @page {
                size: A4;
                margin: 0;
              }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 0;">
          ${clone.outerHTML}
        </body>
      </html>
    `)
    
    printWindow.document.close()
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 500)
    }
  }, [studentName, stepName])

  // Prévisualiser le bulletin (sans scroll bar)
  const handlePreview = useCallback(() => {
    if (!bulletinRef.current) {
      toast.error("Le bulletin n'est pas encore chargé")
      return
    }

    // Créer un clone sans contraintes
    const clone = createPrintableClone()
    if (!clone) return
    
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]')
    let stylesHTML = ''
    
    styles.forEach(style => {
      if (style.tagName === 'STYLE') {
        stylesHTML += style.outerHTML
      } else if (style.tagName === 'LINK') {
        stylesHTML += style.outerHTML
      }
    })
    
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      toast.error("Impossible d'ouvrir la fenêtre de prévisualisation")
      return
    }
    
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bulletin de ${studentName} - ${stepName}</title>
          <meta charset="UTF-8">
          ${stylesHTML}
          <style>
            * {
              overflow: visible !important;
              height: auto !important;
              max-height: none !important;
            }
            body {
              margin: 0;
              padding: 20px;
              background: #f5f5f5;
              display: flex;
              justify-content: center;
            }
            .bulletin-container {
              background: white;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              margin: 0 auto;
              width: 210mm;
            }
            .print-btn {
              position: fixed;
              bottom: 20px;
              right: 20px;
              padding: 12px 24px;
              background: #2C4A6E;
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              z-index: 1000;
            }
            .print-btn:hover {
              background: #1e3a5a;
            }
          </style>
        </head>
        <body>
          <div class="bulletin-container">
            ${clone.outerHTML}
          </div>
          <button class="print-btn" onclick="window.print()">🖨️ Imprimer le bulletin</button>
        </body>
      </html>
    `)
    
    previewWindow.document.close()
  }, [studentName, stepName])

  useEffect(() => {
    if (open && !hasFetched) {
      fetchBulletinData()
    }
  }, [open, hasFetched, fetchBulletinData])

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setHasFetched(false)
      setBulletinData(null)
    }
    onOpenChange(newOpen)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Bulletin de {studentName}</span>
            <span className="text-sm font-normal text-muted-foreground">{className} - {stepName}</span>
          </DialogTitle>
          <DialogDescription>Consultez et générez le bulletin de l'élève</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : bulletinData ? (
            <div 
              ref={bulletinRef}
              style={{ 
                backgroundColor: 'white',
                borderRadius: '8px'
              }}
            >
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
                <Button 
                  onClick={generatePDFFromHTML} 
                  style={{ backgroundColor: '#2C4A6E', color: 'white' }}
                  disabled={generating}
                >
                  <Download className="mr-2 h-4 w-4" /> Télécharger PDF
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handlePreview}
                  disabled={generating}
                >
                  <Eye className="mr-2 h-4 w-4" /> Prévisualiser
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handlePrint}
                  disabled={generating}
                >
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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}