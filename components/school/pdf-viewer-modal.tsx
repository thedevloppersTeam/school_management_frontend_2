"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ZoomOutIcon, DownloadIcon, XIcon } from "lucide-react"
import { CPMSLReportTemplate } from "@/components/school/cpmsl-report-template"
import { type Student, type Level, type Period, type SubjectParent, type SubjectChild, type Grade, type StudentBehavior, type Attitude } from "@/lib/data/school-data"

interface PDFViewerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: Student[]
  level?: Level
  period?: Period
  subjectParents: SubjectParent[]
  subjectChildren: SubjectChild[]
  grades: Grade[]
  behaviors?: StudentBehavior[]
  attitudes: Attitude[]
  academicYear?: string
  onDownload?: () => void
}

export function PDFViewerModal({
  open,
  onOpenChange,
  students,
  level,
  period,
  subjectParents,
  subjectChildren,
  grades,
  behaviors = [],
  attitudes,
  academicYear,
  onDownload,
}: PDFViewerModalProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(100)

  const totalPages = students.length

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
    setZoom(Math.min(zoom + 10, 200))
  }

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 10, 50))
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset to first page when closing
    setCurrentPage(1)
  }

  const currentStudent = students[currentPage - 1]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 gap-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
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
            <span className="text-sm text-muted-foreground mr-2">Zoom :</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
            >
              <ZoomOutIcon className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[50px] text-center">
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
              <Button
                variant="default"
                size="sm"
                onClick={onDownload}
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              <XIcon className="h-4 w-4 mr-2" />
              Fermer
            </Button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-muted p-8">
          <div 
            className="mx-auto bg-white shadow-lg transition-all duration-200"
            style={{ 
              width: `${8.5 * zoom}px`,
              aspectRatio: '8.5 / 11'
            }}
          >
            {currentStudent && level && period && (
              <CPMSLReportTemplate
                student={currentStudent}
                level={level}
                period={period}
                subjectParents={subjectParents}
                subjectChildren={subjectChildren}
                grades={grades.filter(g => g.studentId === currentStudent.id)}
                behavior={behaviors.find(b => b.studentId === currentStudent.id)}
                attitudes={attitudes}
                academicYear={academicYear || ''}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}