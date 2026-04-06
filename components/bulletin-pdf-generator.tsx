// components/bulletin-pdf-generator.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, Download, Eye, Printer } from "lucide-react"
import { toast } from "sonner"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { buildBulletinData } from "@/lib/api/bulletin"
import BulletinScolaire, { type BulletinData } from "./BulletinScolaire"

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
  yearId:         string   // ← nouveau : pour charger attitudes + behavior
  onDownload?:    () => void
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
      toast.error("Erreur lors de la récupération des données du bulletin")
    } finally {
      setLoading(false)
    }
  }, [open, hasFetched, studentId, enrollmentId, classSessionId, stepId, studentName, className, stepName, yearId])

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