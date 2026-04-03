// components/school/batch-bulletin-generator.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Download, FileText, CheckCircle2, XCircle, Eye } from "lucide-react"
import { toast } from "sonner"
import { reportsApi, gradesApi, classSubjectsApi } from "@/services/api"
import { parseDecimal } from "@/lib/decimal"

interface BatchBulletinGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classSessionId: string
  stepId: string
  studentIds: string[]
  studentNames: Map<string, string>
  enrollmentIds: Map<string, string>
  className: string
  stepName: string
  onComplete?: () => void
  onViewStudent?: (studentId: string, studentName: string, enrollmentId: string) => void
}

interface StudentStatus {
  status: 'pending' | 'loading' | 'success' | 'error'
  message?: string
  gradesCount?: number
  average?: number
  totalSubjects?: number
}

export function BatchBulletinGenerator({
  open,
  onOpenChange,
  classSessionId,
  stepId,
  studentIds,
  studentNames,
  enrollmentIds,
  className,
  stepName,
  onComplete,
  onViewStudent
}: BatchBulletinGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<Map<string, StudentStatus>>(new Map())
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const [previewData, setPreviewData] = useState<Map<string, any>>(new Map())
  const [subjects, setSubjects] = useState<any[]>([])

  // Récupérer les matières une fois
  useEffect(() => {
    async function fetchSubjects() {
      try {
        const subjectsData = await classSubjectsApi.getAll({ classSessionId })
        setSubjects(subjectsData)
      } catch (error) {
        console.error("Error fetching subjects:", error)
        toast.error("Erreur lors de la récupération des matières")
      }
    }
    if (classSessionId && open) {
      fetchSubjects()
    }
  }, [classSessionId, open])

  // Vérifier les notes avant génération
  const checkGrades = async () => {
    if (subjects.length === 0) {
      toast.error("Aucune matière trouvée pour cette classe")
      return
    }
    
    setLoading(true)
    
    const initialStatus = new Map<string, StudentStatus>()
    studentIds.forEach(id => {
      initialStatus.set(id, { status: 'pending' })
    })
    setStatus(initialStatus)

    let processed = 0
    for (const studentId of studentIds) {
      const enrollmentId = enrollmentIds.get(studentId)
      if (!enrollmentId) {
        const newStatus = new Map(status)
        newStatus.set(studentId, { status: 'error', message: 'Inscription non trouvée' })
        setStatus(newStatus)
        processed++
        setProgress((processed / studentIds.length) * 100)
        continue
      }

      try {
        const newStatus = new Map(status)
        newStatus.set(studentId, { status: 'loading' })
        setStatus(newStatus)
        
        // Récupérer les notes de l'élève
        const gradesData = await gradesApi.getByEnrollment(enrollmentId, { stepId })
        
        const validGrades = gradesData.filter(g => {
  const score = parseDecimal(g.studentScore)
  return score !== null && score !== undefined && !isNaN(score)
})
        
        const gradesCount = validGrades.length
        const totalSubjects = subjects.length
        
        // Calculer la moyenne avec les coefficients
        let totalWeightedScore = 0
        let totalCoef = 0
        
       for (const grade of validGrades) {
  const subject = subjects.find(s => s.id === grade.classSubjectId)
  if (subject) {
    const maxScore = parseDecimal(subject.subject?.maxScore) || 20
    const coefficient = parseDecimal(subject.coefficientOverride ?? subject.subject?.coefficient) || 1
    const studentScore = parseDecimal(grade.studentScore) || 0
    // Normaliser sur 20
    const normalizedScore = (studentScore * 20) / maxScore
    totalWeightedScore += normalizedScore * coefficient
    totalCoef += coefficient
  }
}

const average = totalCoef > 0 ? totalWeightedScore / totalCoef : null
        
        const finalStatus = new Map(status)
        finalStatus.set(studentId, { 
          status: gradesCount === totalSubjects ? 'success' : 'pending',
          gradesCount,
          average: average || undefined,
          totalSubjects
        })
        setStatus(finalStatus)
        
        setPreviewData(prev => new Map(prev).set(studentId, { gradesCount, totalSubjects, average }))
      } catch (error) {
        console.error(`Error fetching grades for student ${studentId}:`, error)
        const errorStatus = new Map(status)
        errorStatus.set(studentId, { status: 'error', message: 'Erreur de récupération' })
        setStatus(errorStatus)
      }
      
      processed++
      setProgress((processed / studentIds.length) * 100)
    }
    
    setLoading(false)
  }

  const generateAll = async () => {
    setLoading(true)
    
    try {
      const blob = await reportsApi.generateBulletins(classSessionId, stepId, studentIds)
      setZipBlob(blob)
      
      const successStatus = new Map<string, StudentStatus>()
      studentIds.forEach(id => {
        const existing = status.get(id)
        successStatus.set(id, { 
          status: 'success',
          gradesCount: existing?.gradesCount,
          average: existing?.average,
          totalSubjects: existing?.totalSubjects
        })
      })
      setStatus(successStatus)
      setProgress(100)
      toast.success(`${studentIds.length} bulletins générés avec succès`)
      if (onComplete) onComplete()
    } catch (error) {
      console.error("Erreur lors de la génération:", error)
      toast.error("Erreur lors de la génération des bulletins")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (zipBlob) {
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bulletins_${className}_${stepName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Archive téléchargée")
    }
  }

  useEffect(() => {
    if (open && subjects.length > 0) {
      checkGrades()
      setZipBlob(null)
    }
  }, [open, subjects.length])

  const successCount = Array.from(status.values()).filter(s => s.status === 'success').length
  const errorCount = Array.from(status.values()).filter(s => s.status === 'error').length
  const readyCount = Array.from(status.values()).filter(s => {
    if (s.status === 'success') return true
    if (s.status === 'pending' && s.gradesCount && s.gradesCount > 0) return true
    return false
  }).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Génération des bulletins - {className} - {stepName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto space-y-6">
          {/* Statistiques */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-gray-50 text-center">
              <div className="text-2xl font-bold">{studentIds.length}</div>
              <div className="text-xs text-muted-foreground">Total élèves</div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-center">
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <div className="text-xs text-muted-foreground">Générés</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-center">
              <div className="text-2xl font-bold text-blue-600">{readyCount}</div>
              <div className="text-xs text-muted-foreground">Prêts</div>
            </div>
            <div className="p-3 rounded-lg bg-red-50 text-center">
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              <div className="text-xs text-muted-foreground">Erreurs</div>
            </div>
          </div>
          
          {/* Progression */}
          {loading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Vérification des notes...
              </p>
            </div>
          )}
          
          {/* Liste des élèves avec aperçu */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Élève</th>
                  <th className="px-3 py-2 text-center">Notes</th>
                  <th className="px-3 py-2 text-center">Moyenne</th>
                  <th className="px-3 py-2 text-center">Statut</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentIds.map(id => {
                  const studentStatus = status.get(id)
                  const preview = previewData.get(id)
                  const enrollmentId = enrollmentIds.get(id)
                  
                  return (
                    <tr key={id} className="border-t">
                      <td className="px-3 py-2 font-medium">{studentNames.get(id)}</td>
                      <td className="px-3 py-2 text-center">
                        {preview ? `${preview.gradesCount}/${preview.totalSubjects}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {preview?.average ? (
                         <span className={preview.average >= 10 ? 'text-green-600' : 'text-red-600'}>
  {preview.average.toFixed(2)}
</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {studentStatus?.status === 'pending' && (
                          <span className="text-yellow-600 text-xs flex items-center justify-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> En attente
                          </span>
                        )}
                        {studentStatus?.status === 'loading' && (
                          <span className="text-blue-600 text-xs flex items-center justify-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Vérification
                          </span>
                        )}
                        {studentStatus?.status === 'success' && (
                          <span className="text-green-600 text-xs flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Généré
                          </span>
                        )}
                        {studentStatus?.status === 'error' && (
                          <span className="text-red-600 text-xs flex items-center justify-center gap-1">
                            <XCircle className="h-3 w-3" /> {studentStatus.message}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {enrollmentId && onViewStudent && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onViewStudent(id, studentNames.get(id) || '', enrollmentId)}
                            disabled={!preview || preview.gradesCount === 0}
                            title="Voir l'aperçu"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        <DialogFooter className="gap-2 pt-4 border-t">
          {!zipBlob && !loading && (
            <Button 
              onClick={generateAll} 
              disabled={readyCount === 0}
              style={{
                backgroundColor: readyCount > 0 ? '#2C4A6E' : '#9CA3AF',
                color: 'white'
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Générer {readyCount} bulletin{readyCount > 1 ? 's' : ''}
            </Button>
          )}
          {zipBlob && (
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Télécharger l'archive ({successCount} bulletins)
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}