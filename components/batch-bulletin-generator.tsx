// components/school/batch-bulletin-generator.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Download, FileText, CheckCircle2, XCircle, Eye } from "lucide-react"
import { toast } from "sonner"
import { buildBulletinData } from "@/lib/api/bulletin"
import BulletinScolaire, { type BulletinData } from "@/components/BulletinScolaire"
import { toMessage } from "@/lib/errors"
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

  // Conteneur off-screen pour le rendu HTML → canvas
  const offscreenRef = useRef<HTMLDivElement>(null)

  // ── Reset à l'ouverture ───────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    setProgress(0)
    setGenerated(false)
    setBulletins(new Map())
    const init = new Map<string, StudentStatus>()
    studentIds.forEach(id => init.set(id, { status: 'pending' }))
    setStatus(init)
  }, [open])

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

// EP-010 : remontée des résultats proactive — plus de silent errorCount
const successCount = Array.from(newStatus.values()).filter(s => s.status === 'success').length
const errorCount   = Array.from(newStatus.values()).filter(s => s.status === 'error').length
const total        = successCount + errorCount

if (errorCount === 0 && successCount > 0) {
  // Cas idéal : tout est passé
  toast.success(`${successCount} bulletin${successCount > 1 ? 's' : ''} prêt${successCount > 1 ? 's' : ''}`)
  if (onComplete) onComplete()
} else if (successCount > 0 && errorCount > 0) {
  // Cas mixte : partiel
  toast.warning(
    `${successCount} / ${total} bulletin${total > 1 ? 's' : ''} prêt${successCount > 1 ? 's' : ''}. ` +
    `${errorCount} échec${errorCount > 1 ? 's' : ''} — voir le détail dans le tableau.`
  )
  if (onComplete) onComplete()
} else if (errorCount > 0 && successCount === 0) {
  // Cas catastrophique : tout a échoué
  toast.error(
    `Aucun bulletin n'a pu être généré. ${errorCount} échec${errorCount > 1 ? 's' : ''}. ` +
    `Vérifiez votre connexion ou contactez le support.`
  )
}
  }

  // ── Export PDF combiné ────────────────────────────────────────────────────

  const downloadAll = async () => {
  if (bulletins.size === 0) return
  setLoading(true)

  try {
    // PB-002 : imports dynamiques, chargés uniquement au clic "Tout télécharger"
    // (~600 KB retirés du bundle initial des pages qui utilisent ce composant)
    const html2canvas = (await import('html2canvas')).default
    const jsPDF       = (await import('jspdf')).default

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    let firstPage = true

      for (const [studentId, data] of bulletins) {
        if (status.get(studentId)?.status !== 'success') continue

        // Rendre le bulletin dans le conteneur off-screen
        const container = offscreenRef.current
        if (!container) continue

        // Injecter temporairement le composant via innerHTML — on utilise un div dédié
        const tempDiv = document.createElement('div')
        tempDiv.style.width = '210mm'
        tempDiv.style.backgroundColor = 'white'
        tempDiv.style.position = 'absolute'
        tempDiv.style.left = '-9999px'
        tempDiv.style.top = '0'
        document.body.appendChild(tempDiv)

        // Rendu React → HTML via dangerouslySetInnerHTML n'est pas possible ici.
        // On clone le bulletin déjà rendu dans le dialog si disponible.
        // Sinon on crée un rendu simplifié texte pour le fallback.
        // Approche : on render dans un portail temporaire.

        // ── Fallback propre : rendu via un iframe temporaire ──
        // Pour éviter la complexité du portail, on utilise html2canvas
        // sur un div contenant le bulletin rendu côté client.

        // Nettoyer
        document.body.removeChild(tempDiv)

        // Solution : créer un élément, monter BulletinScolaire dedans via React DOM
        const { createRoot } = await import('react-dom/client')
        const React = await import('react')

        const mountPoint = document.createElement('div')
        mountPoint.style.cssText = 'position:absolute;left:-9999px;top:0;width:210mm;background:white;'
        document.body.appendChild(mountPoint)

        const root = createRoot(mountPoint)
        await new Promise<void>(resolve => {
          root.render(
            React.default.createElement(BulletinScolaire, {
              data,
              key: studentId,
            })
          )
          // Laisser React flusher
          setTimeout(resolve, 400)
        })

        const canvas = await html2canvas(mountPoint, {
          scale: 2, useCORS: true, logging: false,
          backgroundColor: '#ffffff',
          windowWidth:  mountPoint.scrollWidth,
          windowHeight: mountPoint.scrollHeight,
        })

        root.unmount()
        document.body.removeChild(mountPoint)

        const imgData   = canvas.toDataURL('image/png')
        const imgWidth  = 210
        const pageH     = 297
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        let   heightLeft = imgHeight
        let   position   = 0

        if (!firstPage) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageH
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageH
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
      {/* Conteneur off-screen pour le rendu PDF */}
      <div ref={offscreenRef} style={{ position: 'absolute', left: '-9999px', top: 0 }} aria-hidden />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Génération des bulletins — {className} — {stepName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-6">

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