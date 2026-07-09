// components/school/batch-bulletin-generator.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Download, FileText, CheckCircle2, XCircle, Eye } from "lucide-react"
import { toast } from "sonner"
import jsPDF from "jspdf"
import { buildBulletinData } from "@/lib/api/bulletin"
import { type BulletinData } from "@/components/BulletinScolaire"
import { BulletinPrintable } from "@/components/school/bulletin-printable"
import {
  addBulletinCanvasToPdf,
  captureBulletinElement,
  createBulletinPdfHost,
  waitForTwoFrames,
} from "@/lib/bulletin-pdf-capture"

// ── Props ─────────────────────────────────────────────────────────────────────

interface BatchBulletinGeneratorProps {
  open:           boolean
  onOpenChange:   (open: boolean) => void
  classSessionId: string
  stepId:         string
  stepName:       string
  className:      string
  yearId:         string    // ← nouveau
  studentIds:     string[]
  studentNames:   Map<string, string>
  enrollmentIds:  Map<string, string>
  onComplete?:    () => void
  onViewStudent?: (studentId: string, studentName: string, enrollmentId: string) => void
}

// ── Types internes ─────────────────────────────────────────────────────────────

interface StudentStatus {
  status:    'pending' | 'loading' | 'success' | 'error'
  message?:  string
  average?:  number
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function BatchBulletinGenerator({
  open,
  onOpenChange,
  classSessionId,
  stepId,
  stepName,
  className,
  yearId,
  studentIds,
  studentNames,
  enrollmentIds,
  onComplete,
  onViewStudent,
}: Readonly<BatchBulletinGeneratorProps>) {
  const [loading,      setLoading]      = useState(false)
  const [progress,     setProgress]     = useState(0)
  const [status,       setStatus]       = useState<Map<string, StudentStatus>>(new Map())
  const [bulletins,    setBulletins]    = useState<Map<string, BulletinData>>(new Map())
  const [generated,    setGenerated]    = useState(false)
  const [includeGeneralAverage, setIncludeGeneralAverage] = useState(false)

  // ── Reset à l'ouverture ───────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    const init = new Map<string, StudentStatus>()
    studentIds.forEach(id => init.set(id, { status: 'pending' }))

    void Promise.resolve().then(() => {
      setProgress(0)
      setGenerated(false)
      setBulletins(new Map())
      setStatus(init)
    })
  }, [open, studentIds])

  // ── Génération de tous les bulletins ──────────────────────────────────────

  const generateAll = async () => {
    setLoading(true)
    setProgress(0)

    const newBulletins = new Map<string, BulletinData>()
    const newStatus    = new Map<string, StudentStatus>()
    studentIds.forEach(id => newStatus.set(id, { status: 'loading' }))
    setStatus(new Map(newStatus))

    let processed = 0

    for (const studentId of studentIds) {
      const enrollmentId = enrollmentIds.get(studentId)
      if (!enrollmentId) {
        newStatus.set(studentId, { status: 'error', message: 'Inscription non trouvée' })
        setStatus(new Map(newStatus))
        processed++
        setProgress(Math.round((processed / studentIds.length) * 100))
        continue
      }

      try {
        const data = await buildBulletinData({
          enrollmentId,
          studentId,
          classSessionId,
          stepId,
          stepName,
          className,
          yearId,
          includeGeneralAverage,
        })
        newBulletins.set(studentId, data)
        newStatus.set(studentId, {
          status:  'success',
                    average: Number.parseFloat(data.moyenneEtape) || undefined,
        })
      } catch (err) {
        console.error(`[BatchGenerator] student ${studentId}:`, err)
        newStatus.set(studentId, { status: 'error', message: 'Erreur de génération' })
      }

      processed++
      setProgress(Math.round((processed / studentIds.length) * 100))
      setStatus(new Map(newStatus))
    }

    setBulletins(newBulletins)
    setLoading(false)
    setGenerated(true)

    const successCount = Array.from(newStatus.values()).filter(s => s.status === 'success').length
    if (successCount > 0) {
      toast.success(`${successCount} bulletin${successCount > 1 ? 's' : ''} prêt${successCount > 1 ? 's' : ''}`)
      if (onComplete) onComplete()
    }
  }

  // ── Export PDF combiné ────────────────────────────────────────────────────

  const downloadAll = async () => {
    if (bulletins.size === 0) return
    setLoading(true)

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter',
        compress: true,
      })
      let firstPage = true

      for (const [studentId, data] of bulletins) {
        if (status.get(studentId)?.status !== 'success') continue

        // Solution : créer un élément, monter BulletinScolaire dedans via React DOM
        const { createRoot } = await import('react-dom/client')
        const React = await import('react')

        const mountPoint = createBulletinPdfHost()
        document.body.appendChild(mountPoint)

        const root = createRoot(mountPoint)
        try {
          root.render(
            React.default.createElement(BulletinPrintable, {
              data,
              renderMode: "pdf",
              key: studentId,
            })
          )
          await waitForTwoFrames()

          if (!firstPage) pdf.addPage("letter", "portrait")
          const { canvas } = await captureBulletinElement(mountPoint)
          addBulletinCanvasToPdf(pdf, canvas)
        } finally {
          root.unmount()
          mountPoint.remove()
        }

        firstPage = false
      }

      pdf.save(`bulletins_${className}_${stepName}.pdf`)
      toast.success("Archive PDF téléchargée")
    } catch (err) {
      console.error('[BatchGenerator] downloadAll:', err)
      toast.error("Erreur lors de l'export PDF")
    } finally {
      setLoading(false)
    }
  }

  // ── Dérivés ───────────────────────────────────────────────────────────────

  const successCount = Array.from(status.values()).filter(s => s.status === 'success').length
  const errorCount   = Array.from(status.values()).filter(s => s.status === 'error').length

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Génération des bulletins — {className} — {stepName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-6">

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="batch-include-general-average"
                  checked={includeGeneralAverage}
                  onCheckedChange={(checked) => setIncludeGeneralAverage(checked === true)}
                  disabled={loading}
                />
                <div className="space-y-1 leading-none">
                  <label htmlFor="batch-include-general-average" className="text-sm font-medium leading-none">
                    Calculer la moyenne générale
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Calcul côté frontend et affichage sous le bloc moyenne du PDF.
                  </p>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#F0F4F7' }}>
                <div className="text-2xl font-bold" style={{ color: '#2A3740' }}>{studentIds.length}</div>
                <div className="text-xs" style={{ color: '#78756F' }}>Total élèves</div>
              </div>
              <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#E8F5EC' }}>
                <div className="text-2xl font-bold" style={{ color: '#2D7D46' }}>{successCount}</div>
                <div className="text-xs" style={{ color: '#78756F' }}>Générés</div>
              </div>
              <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#FCEBEB' }}>
                <div className="text-2xl font-bold" style={{ color: '#A32D2D' }}>{errorCount}</div>
                <div className="text-xs" style={{ color: '#78756F' }}>Erreurs</div>
              </div>
            </div>

            {/* Barre de progression */}
            {loading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center" style={{ color: '#78756F' }}>
                  {progress}% — génération en cours...
                </p>
              </div>
            )}

            {/* Tableau élèves */}
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E8E6E3' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#F1F5F9' }}>
                  <tr>
                    <th className="px-3 py-2 text-left" style={{ fontSize: '12px', fontWeight: 700, color: '#2C4A6E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Élève</th>
                    <th className="px-3 py-2 text-center" style={{ fontSize: '12px', fontWeight: 700, color: '#2C4A6E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Moyenne</th>
                    <th className="px-3 py-2 text-center" style={{ fontSize: '12px', fontWeight: 700, color: '#2C4A6E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Statut</th>
                    <th className="px-3 py-2 text-center" style={{ fontSize: '12px', fontWeight: 700, color: '#2C4A6E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Aperçu</th>
                  </tr>
                </thead>
                <tbody>
                  {studentIds.map((id, i) => {
                    const s   = status.get(id)
                    const avg = s?.average
                    const enrId = enrollmentIds.get(id)

                    return (
                      <tr key={id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                        <td className="px-3 py-2 font-medium" style={{ color: '#1E1A17' }}>
                          {studentNames.get(id)}
                        </td>
                        <td className="px-3 py-2 text-center" style={{ fontWeight: 600, color: avg !== undefined ? (avg >= 6 ? '#2D7D46' : '#A32D2D') : '#A8A5A2' }}>
                          {avg !== undefined ? avg.toFixed(2) : '—'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {s?.status === 'pending'  && <span style={{ color: '#78756F',  fontSize: '12px' }}>En attente</span>}
                          {s?.status === 'loading'  && <span style={{ color: '#2B6CB0',  fontSize: '12px' }} className="flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Génération</span>}
                          {s?.status === 'success'  && <span style={{ color: '#2D7D46',  fontSize: '12px' }} className="flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3" />Prêt</span>}
                          {s?.status === 'error'    && <span style={{ color: '#A32D2D',  fontSize: '12px' }} className="flex items-center justify-center gap-1"><XCircle className="h-3 w-3" />{s.message}</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {enrId && onViewStudent && s?.status === 'success' && (
                            <Button size="sm" variant="ghost"
                              onClick={() => onViewStudent(id, studentNames.get(id) ?? '', enrId)}>
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

          <DialogFooter className="gap-2 pt-4" style={{ borderTop: '1px solid #E8E6E3' }}>
            {!generated && !loading && (
              <Button onClick={generateAll}
                style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
                <FileText className="mr-2 h-4 w-4" />
                Générer {studentIds.length} bulletin{studentIds.length > 1 ? 's' : ''}
              </Button>
            )}
            {generated && !loading && successCount > 0 && (
              <Button onClick={downloadAll}
                style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
                <Download className="mr-2 h-4 w-4" />
                Télécharger PDF ({successCount} bulletin{successCount > 1 ? 's' : ''})
              </Button>
            )}
            {loading && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération en cours...
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
