// components/bulletin-pdf-generator.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Download, Eye, Printer, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { buildBulletinData } from "@/lib/api/bulletin"
import { toMessage } from "@/lib/errors"
import BulletinScolaire, { type BulletinData } from "./BulletinScolaire"

// ── Props ─────────────────────────────────────────────────────────────────────

interface BulletinPDFGeneratorProps {
  open:             boolean
  onOpenChange:     (open: boolean) => void
  studentId:        string
  studentName:      string
  classSessionId:   string
  stepId:           string
  stepName:         string
  className:        string
  enrollmentId:     string
  yearId:           string
  stepIsCurrent?:   boolean
  snapshotData?:    BulletinData
  onDownload?:      () => void
}

// ── Helper archive (EP-003 : retourne un résultat, ne swallow plus) ──────────
//
// AVANT : try { fetch } catch { console.error } — erreur silencieuse
// APRÈS : on retourne { ok: true } ou { ok: false, error } pour que
//         l'appelant puisse décider d'alerter l'utilisateur.
//
// Règle métier inchangée : un échec d'archivage NE BLOQUE PAS le
// téléchargement du PDF (l'utilisateur a déjà le fichier). Mais
// l'utilisateur DOIT savoir que l'archive est incomplète pour pouvoir
// relancer ou contacter le support.

async function archiveBulletin(params: {
  enrollmentId:     string
  stepId:           string
  source:           'individual' | 'batch'
  bulletinSnapshot: BulletinData
  isCorrection:     boolean
  auditNote?:       string
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const res = await fetch('/api/bulletin-archives/create', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(params),
    })
    if (!res.ok) {
      return { ok: false, error: new Error(`HTTP ${res.status}`) }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err }
  }
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
  yearId,
  stepIsCurrent = true,
  snapshotData,
  onDownload,
}: Readonly<BulletinPDFGeneratorProps>) {
  const [loading,      setLoading]      = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null)
  const [hasFetched,   setHasFetched]   = useState(false)
  const bulletinRef = useRef<HTMLDivElement>(null)

  // ── REQ-F-010 : modal audit note pour correction post-clôture ─────────────
  const [auditModalOpen,  setAuditModalOpen]  = useState(false)
  const [auditNote,       setAuditNote]       = useState("")
  const [auditSubmitting, setAuditSubmitting] = useState(false)

  const isCorrection = !stepIsCurrent

  // ── Construction des données ────────────────────────────────────────────────

  const fetchBulletinData = useCallback(async () => {
    if (!open || hasFetched) return

    if (snapshotData) {
      setBulletinData(snapshotData)
      setHasFetched(true)
      return
    }

    setLoading(true)
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
      setBulletinData(data)
      setHasFetched(true)
    } catch (error) {
      console.error('[BulletinPDFGenerator] fetchBulletinData:', error)
      // Message métier au lieu du texte technique
      toast.error(toMessage(error, "lors de la récupération des données du bulletin"))
    } finally {
      setLoading(false)
    }
  }, [open, hasFetched, studentId, enrollmentId, classSessionId, stepId, studentName, className, stepName, yearId, snapshotData])

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

  // ── Génération effective + archivage ──────────────────────────────────────
  //
  // Corrections PB-001 / EP-003 / WF-008 appliquées ici :
  //
  //   PB-001 : les imports html2canvas et jspdf deviennent dynamiques
  //            (~600 KB retirés du bundle initial). Ils ne sont chargés
  //            qu'au moment du clic "Télécharger PDF".
  //
  //   EP-003 : archiveBulletin retourne un résultat structuré au lieu
  //            d'un silent fail. On capture et on remonte.
  //
  //   WF-008 : le toast de succès ("Bulletin téléchargé") ne s'affiche
  //            plus AVANT l'archivage. On attend le résultat et on
  //            ajuste le message selon succès / partiel / échec archive.

  const doGeneratePDF = async (note?: string) => {
    if (!bulletinRef.current || !bulletinData) return
    setGenerating(true)

    let pdfSaved = false

    try {
      // PB-001 : imports dynamiques, chargés uniquement à la demande
      const html2canvas = (await import('html2canvas')).default
      const jsPDF       = (await import('jspdf')).default

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

      const imgData    = canvas.toDataURL('image/png')
      const pdf        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const imgWidth   = 210
      const pageHeight = 297
      const imgHeight  = (canvas.height * imgWidth) / canvas.width
      let heightLeft   = imgHeight
      let position     = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`bulletin_${bulletinData.nom ?? studentName}_${stepName}.pdf`)
      pdfSaved = true

      // ── REQ-F-007 : archiver après génération ─────────────────────────
      // WF-008 + EP-003 : le résultat est remonté à l'utilisateur
      const archiveResult = await archiveBulletin({
        enrollmentId,
        stepId,
        source:           'individual',
        bulletinSnapshot: bulletinData,
        isCorrection,
        auditNote:        note,
      })

      if (archiveResult.ok) {
        toast.success("Bulletin téléchargé et archivé")
      } else {
        console.error('[archiveBulletin] échec individuel:', archiveResult.error)
        // Le PDF est bien téléchargé, mais l'archive est incomplète.
        // Le toast doit être clair sur les deux aspects.
        toast.warning(
          "Bulletin téléchargé, mais son archivage a échoué. " +
          "L'historique est incomplet. Contactez le support si nécessaire."
        )
      }

      if (onDownload) onDownload()
    } catch (error) {
      console.error('[BulletinPDFGenerator] generatePDF:', error)
      // WF-008 : différencier selon qu'on ait sauvé le PDF ou non
      if (pdfSaved) {
        toast.error(toMessage(error, "lors de la finalisation du bulletin"))
      } else {
        toast.error(toMessage(error, "lors de la génération du bulletin"))
      }
    } finally {
      setGenerating(false)
    }
  }

  // ── Point d'entrée génération — détecte correction ────────────────────────

  const generatePDFFromHTML = async () => {
    if (!bulletinRef.current) { toast.error("Le bulletin n'est pas encore chargé"); return }

    if (isCorrection) {
      setAuditNote("")
      setAuditModalOpen(true)
      return
    }

    await doGeneratePDF()
  }

  // ── Confirmation correction ───────────────────────────────────────────────

  const handleConfirmCorrection = async () => {
    if (!auditNote.trim()) return
    setAuditSubmitting(true)
    setAuditModalOpen(false)
    await doGeneratePDF(auditNote.trim())
    setAuditSubmitting(false)
    setAuditNote("")
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
    const htmlContent = `<!DOCTYPE html><html><head>
      <title>Bulletin de ${studentName} - ${stepName}</title>
      <meta charset="UTF-8">${getStylesHTML()}
      <style>*{overflow:visible!important;height:auto!important;max-height:none!important;}
      body{margin:0;padding:0;background:white;}
      @media print{@page{size:A4;margin:0;}}</style>
    </head><body style="margin:0;padding:0;">${clone.outerHTML}</body></html>`
    w.document.documentElement.innerHTML = htmlContent
    w.onload = () => setTimeout(() => { w.print(); w.close() }, 500)
  }, [studentName, stepName])

  // ── Prévisualisation ───────────────────────────────────────────────────────

  const handlePreview = useCallback(() => {
    if (!bulletinRef.current) { toast.error("Le bulletin n'est pas encore chargé"); return }
    const clone = createPrintableClone()
    if (!clone) return
    const w = window.open('', '_blank')
    if (!w) { toast.error("Impossible d'ouvrir la prévisualisation"); return }
    const htmlContent = `<!DOCTYPE html><html><head>
      <title>Bulletin de ${studentName} - ${stepName}</title>
      <meta charset="UTF-8">${getStylesHTML()}
      <style>*{overflow:visible!important;height:auto!important;max-height:none!important;}
      body{margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;}
      .bc{background:white;box-shadow:0 0 10px rgba(0,0,0,0.1);margin:0 auto;width:210mm;}
      .pb{position:fixed;bottom:20px;right:20px;padding:12px 24px;background:#2C4A6E;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;z-index:1000;}
      .pb:hover{background:#1e3a5a;}</style>
    </head><body>
      <div class="bc">${clone.outerHTML}</div>
      <button class="pb" onclick="window.print()">Imprimer</button>
    </body></html>`
    w.document.documentElement.innerHTML = htmlContent
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
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Bulletin de {studentName}</span>
              <span className="text-sm font-normal text-muted-foreground">{className} — {stepName}</span>
            </DialogTitle>
            <DialogDescription>Consultez et générez le bulletin de l&apos;élève</DialogDescription>
          </DialogHeader>

          {/* Bannière correction post-clôture */}
          {isCorrection && (
            <div className="flex items-center gap-3 rounded-lg p-3"
              style={{ backgroundColor: '#FEF6E0', border: '1px solid #C48B1A' }}>
              <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#C48B1A' }} />
              <p className="text-sm font-medium" style={{ color: '#C48B1A' }}>
                Étape clôturée — ce bulletin sera enregistré comme correction (v2+)
              </p>
            </div>
          )}

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

      {/* ── Modal audit note — REQ-F-010 ────────────────────────────────── */}
      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '480px' }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: '20px', fontWeight: 700, color: '#2A3740' }}>
              Correction post-clôture
            </DialogTitle>
            <DialogDescription>
              Une version précédente de ce bulletin existe déjà. Ceci créera une nouvelle version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg p-3" style={{ backgroundColor: '#FEF6E0', border: '1px solid #C48B1A', fontSize: '13px', color: '#92400E' }}>
              La version précédente sera conservée dans l&apos;historique.
            </div>
            <div className="space-y-2">
              <Label className="font-sans" style={{ fontSize: '13px', fontWeight: 500 }}>
                Raison de la correction <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Ex: Erreur de saisie en Mathématiques, note corrigée de 6.5 à 7.0"
                value={auditNote}
                onChange={e => setAuditNote(e.target.value)}
                rows={3}
                style={{ borderColor: '#D1CECC', fontSize: '13px' }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditModalOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirmCorrection}
              disabled={!auditNote.trim() || auditSubmitting}
              style={{ backgroundColor: !auditNote.trim() ? '#9CA3AF' : '#2C4A6E', color: 'white' }}
            >
              {auditSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmer et générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}