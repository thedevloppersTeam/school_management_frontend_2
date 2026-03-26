"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  ZoomInIcon, 
  ZoomOutIcon,
  DownloadIcon,
  XIcon
} from "lucide-react"
import { CPMSLReportTemplate } from "@/components/school/cpmsl-report-template"
import { type Student, type Level, type Period, type Subject, type Grade } from "@/lib/data/school-data"

interface PDFViewerProps {
  pdfUrl?: string
  totalPages: number
  students?: Student[]
  level?: Level
  period?: Period
  subjects?: Subject[]
  grades?: Grade[]
  academicYear?: string
  onDownload?: () => void
  onClose?: () => void
  className?: string
}

export function PDFViewer({ 
  pdfUrl, 
  totalPages,
  students = [],
  level,
  period,
  subjects = [],
  grades = [],
  academicYear = "",
  onDownload, 
  onClose,
  className = ""
}: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(100)

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handleZoomIn = () => {
    if (zoom < 200) {
      setZoom(zoom + 10)
    }
  }

  const handleZoomOut = () => {
    if (zoom > 50) {
      setZoom(zoom - 10)
    }
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-muted/30">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
            >
              <ZoomOutIcon className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center">
              {zoom}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
            >
              <ZoomInIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {onDownload && (
              <Button variant="default" size="sm" onClick={onDownload}>
                <DownloadIcon className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            )}
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                <XIcon className="h-4 w-4 mr-2" />
                Fermer l'aperçu
              </Button>
            )}
          </div>
        </div>

        {/* PDF Display Area */}
        <div className="bg-muted/20 p-8 min-h-[600px] flex items-center justify-center overflow-auto">
          <div 
            className="bg-white shadow-lg"
            style={{ 
              width: `${zoom}%`,
              maxWidth: '100%',
              aspectRatio: '8.5 / 11',
              transition: 'width 0.2s ease'
            }}
          >
            {/* CPMSL Report Template */}
            {students.length > 0 && level && period && academicYear ? (
              <CPMSLReportTemplate
                student={students[currentPage - 1]}
                level={level}
                period={period}
                subjectParents={[]}
                subjectChildren={[]}
                grades={grades.filter(g => g.studentId === students[currentPage - 1]?.id)}
                attitudes={[]}
                academicYear={academicYear}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center border border-border">
                <div className="space-y-4">
                  <div className="text-lg font-bold text-foreground">
                    Bulletin Scolaire
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} / {totalPages}
                  </div>
                  <div className="text-xs text-muted-foreground mt-8">
                    Aperçu du bulletin généré
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {pdfUrl ? `PDF: ${pdfUrl}` : 'PDF généré avec succès'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}