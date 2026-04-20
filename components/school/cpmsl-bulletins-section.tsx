"use client"
import { clientFetch as apiFetch } from '@/lib/client-fetch'
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatCard } from "@/components/school/stat-card"
import { BulletinPDFGenerator } from "@/components/bulletin-pdf-generator"
import BulletinScolaire, { type BulletinData } from "@/components/BulletinScolaire"
import { buildBulletinData } from "@/lib/api/bulletin"
import {
  AlertTriangleIcon, CheckCircleIcon, FileTextIcon, AlertCircleIcon,
  UserIcon, LayersIcon, Loader2, SearchIcon, InboxIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  fetchSteps,
  fetchClassSessions,
  getClassSessionName,
  type AcademicYearStep,
  type ClassSession,
} from "@/lib/api/dashboard"

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnrollmentRow {
  enrollmentId:   string
  studentId:      string
  studentCode:    string
  nisu:           string
  firstname:      string
  lastname:       string
  classSessionId: string
  className:      string
  status:         string
}

interface CPMSLBulletinsSectionProps {
  academicYearId: string
  isArchived?:    boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNisuValid(nisu: string): boolean {
  return !!nisu && /^[A-Z0-9]{14}$/.test(nisu.trim())
}


// ── Helper archive silencieux ─────────────────────────────────────────────────

async function archiveBulletin(params: {
  enrollmentId:     string
  stepId:           string
  source:           'individual' | 'batch'
  bulletinSnapshot: BulletinData
  isCorrection:     boolean
}) {
  try {
    await fetch('/api/bulletin-archives/create', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(params),
    })
  } catch (err) {
    console.error('[archive lot] échec silencieux:', err)
  }
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function CPMSLBulletinsSection({
  academicYearId,
  isArchived = false,
}: CPMSLBulletinsSectionProps) {
  // ── Données ──────────────────────────────────────────────────────────────────
  const [steps,       setSteps]       = useState<AcademicYearStep[]>([])
  const [sessions,    setSessions]    = useState<ClassSession[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [loadingInit,     setLoadingInit]     = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)

  // ── Sélections ───────────────────────────────────────────────────────────────
  const [selectedStep,    setSelectedStep]    = useState("")
  const [selectedSession, setSelectedSession] = useState("")

  // ── PDF Generator ─────────────────────────────────────────────────────────────
  const [pdfOpen,    setPdfOpen]    = useState(false)
  const [pdfStudent, setPdfStudent] = useState<EnrollmentRow | null>(null)

  // ── Génération en lot ──────────────────────────────────────────────────────
  const [generatingLot, setGeneratingLot] = useState(false)
  const [lotProgress,   setLotProgress]   = useState({ current: 0, total: 0 })
  const [lotData,       setLotData]       = useState<BulletinData | null>(null)
  const lotRef = useRef<HTMLDivElement>(null)

  // ── Recherche + pagination ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const PAGE_SIZE_OPTIONS = [15, 25, 50, 100]

  const filteredEnrollments = useMemo(() => {
    if (!searchQuery) return enrollments
    return enrollments.filter(enrollment => {
      const studentName = `${enrollment.firstname} ${enrollment.lastname}`.toLowerCase()
      return studentName.includes(searchQuery.toLowerCase())
    })
  }, [enrollments, searchQuery])

  const paginatedEnrollments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredEnrollments.slice(start, end)
  }, [filteredEnrollments, currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, itemsPerPage])

  // ── Chargement initial ────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [stepsData, sessionsData] = await Promise.all([
          fetchSteps(academicYearId),
          fetchClassSessions(academicYearId),
        ])
        setSteps(stepsData)
        setSessions(sessionsData)
      } catch (err) {
        console.error('[bulletins] init error:', err)
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [academicYearId])

  // ── Chargement élèves quand session sélectionnée ──────────────────────────────
  const loadEnrollments = useCallback(async (sessionId: string) => {
    if (!sessionId) return
    setLoadingStudents(true)
    try {
      const data = await apiFetch<Array<{
        id: string
        studentId: string
        classSessionId: string
        status: string
        student?: {
          id: string
          studentCode?: string
          nisu?: string
          user?: { firstname?: string; lastname?: string }
        }
      }>>(`/api/enrollments?classSessionId=${sessionId}&status=ACTIVE`)

      const session   = sessions.find(s => s.id === sessionId)
      const className = session ? getClassSessionName(session) : ''

      setEnrollments(data.map(enr => ({
        enrollmentId:   enr.id,
        studentId:      enr.studentId,
        studentCode:    enr.student?.studentCode || '—',
        nisu:           enr.student?.nisu || '',
        firstname:      enr.student?.user?.firstname || '',
        lastname:       enr.student?.user?.lastname  || '',
        classSessionId: sessionId,
        className,
        status:         enr.status,
      })))
    } catch (err) {
      console.error('[bulletins] enrollments error:', err)
    } finally {
      setLoadingStudents(false)
    }
  }, [sessions])

  useEffect(() => {
    if (selectedSession) loadEnrollments(selectedSession)
    else setEnrollments([])
  }, [selectedSession, loadEnrollments])

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const withNisu        = enrollments.filter(e => isNisuValid(e.nisu))
  const withoutNisu     = enrollments.filter(e => !isNisuValid(e.nisu))
  const selectedStepObj = steps.find(s => s.id === selectedStep)

  const totalPages = Math.max(1, Math.ceil(filteredEnrollments.length / itemsPerPage))
  const paginationWindow = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis-right', totalPages]
    if (currentPage >= totalPages - 2) {
      return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages]
  }, [currentPage, totalPages])

  // ── Génération en lot ──────────────────────────────────────────────────────
  const generateLot = async () => {
    const eligible = enrollments.filter(e => isNisuValid(e.nisu))
    if (eligible.length === 0 || !selectedStep || !selectedSession) return

    setGeneratingLot(true)
    setLotProgress({ current: 0, total: eligible.length })

    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF       = (await import('jspdf')).default
      const pdf         = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const stepObj     = steps.find(s => s.id === selectedStep)
      const stepName    = stepObj?.name ?? 'etape'
      const isCorrection = !(stepObj?.isCurrent ?? true)
      const sessionObj  = sessions.find(s => s.id === selectedSession)
      const className   = sessionObj ? getClassSessionName(sessionObj) : 'classe'

      for (let i = 0; i < eligible.length; i++) {
        const student = eligible[i]
        setLotProgress({ current: i + 1, total: eligible.length })

        const data = await buildBulletinData({
          enrollmentId:   student.enrollmentId,
          studentId:      student.studentId,
          classSessionId: student.classSessionId,
          stepId:         selectedStep,
          stepName,
          className:      student.className,
          yearId:         academicYearId,
        })

        // Afficher dans le div caché pour capture
        setLotData(data)
        await new Promise(r => setTimeout(r, 600))

        if (!lotRef.current) continue

        const canvas = await html2canvas(lotRef.current, {
          scale: 2, useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth:  lotRef.current.scrollWidth,
          windowHeight: lotRef.current.scrollHeight,
        })

        if (i > 0) pdf.addPage()
        const imgData   = canvas.toDataURL('image/png')
        const imgWidth  = 210
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)

        const pageHeight = 297
        let heightLeft   = imgHeight - pageHeight
        let position     = -pageHeight
        while (heightLeft > 0) {
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
          position   -= pageHeight
        }

        // ── REQ-F-007 : archiver chaque bulletin après génération ─────────
        await archiveBulletin({
          enrollmentId:     student.enrollmentId,
          stepId:           selectedStep,
          source:           'batch',
          bulletinSnapshot: data,
          isCorrection,
        })
      }

      pdf.save(`bulletins_lot_${className}_${stepName}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      console.error('[generateLot]', e)
    } finally {
      setGeneratingLot(false)
      setLotData(null)
      setLotProgress({ current: 0, total: 0 })
    }
  }

  // ── Ouvrir PDF Generator ──────────────────────────────────────────────────────
  const handleGenerateBulletin = (student: EnrollmentRow) => {
    if (!selectedStep) return
    setPdfStudent(student)
    setPdfOpen(true)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  if (loadingInit) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const selectedSessionLabel = sessions.find(s => s.id === selectedSession)
    ? getClassSessionName(sessions.find(s => s.id === selectedSession)!)
    : ''

  return (
    <div className="space-y-6">
      {/* Sélecteurs */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Sélection</CardTitle>
          <CardDescription>Classe et étape pour la génération des bulletins</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select value={selectedStep} onValueChange={setSelectedStep}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une étape" />
              </SelectTrigger>
              <SelectContent>
                {steps.map(step => (
                  <SelectItem key={step.id} value={step.id}>{step.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(session => (
                  <SelectItem key={session.id} value={session.id}>
                    {getClassSessionName(session)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {(!selectedStep || !selectedSession) && (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">Aucune sélection</h3>
            <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
              Sélectionnez une étape et une classe pour commencer la génération des bulletins.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contenu si sélections faites */}
      {selectedStep && selectedSession && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Élèves"
              value={enrollments.length}
              icon={AlertCircleIcon}
              iconClassName="text-blue-600"
              iconBgClassName="bg-blue-50"
            />
            <StatCard
              label="NISU valides"
              value={withNisu.length}
              icon={CheckCircleIcon}
              iconClassName="text-emerald-600"
              iconBgClassName="bg-emerald-50"
            />
            <StatCard
              label="NISU manquants"
              value={withoutNisu.length}
              icon={AlertTriangleIcon}
              iconClassName="text-amber-600"
              iconBgClassName="bg-amber-50"
            />
            <StatCard
              label="Étape"
              value={selectedStepObj?.name || '—'}
              icon={FileTextIcon}
              iconClassName="text-violet-600"
              iconBgClassName="bg-violet-50"
            />
          </div>

          {/* Lot button + progress */}
          <Card className="border bg-card shadow-sm">
            <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center">
              <Button
                onClick={generateLot}
                disabled={isArchived || generatingLot || withNisu.length === 0}
              >
                {generatingLot ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération {lotProgress.current} / {lotProgress.total}...
                  </>
                ) : (
                  <>
                    <LayersIcon className="mr-2 h-4 w-4" />
                    Générer le lot ({withNisu.length} bulletin{withNisu.length > 1 ? 's' : ''})
                  </>
                )}
              </Button>

              {generatingLot && lotProgress.total > 0 && (
                <div className="flex w-full flex-1 items-center gap-3">
                  <Progress
                    value={(lotProgress.current / lotProgress.total) * 100}
                    className="h-2 flex-1 [&>div]:bg-primary"
                  />
                  <span className="whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">
                    {Math.round((lotProgress.current / lotProgress.total) * 100)}%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table card */}
          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Liste des élèves — {selectedSessionLabel}
              </CardTitle>
              <CardDescription>
                {filteredEnrollments.length} élève{filteredEnrollments.length > 1 ? 's' : ''}
                {searchQuery && ` — recherche : "${searchQuery}"`}
              </CardDescription>
            </CardHeader>

            <Separator />

            {/* Search toolbar */}
            <div className="p-4">
              <div className="relative max-w-md">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Separator />

            <CardContent className="p-0">
              {loadingStudents ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <UserIcon className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {searchQuery ? "Aucun élève trouvé" : "Aucun élève actif"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchQuery ? "Modifiez vos critères de recherche." : "Aucun élève actif dans cette classe."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[60px] pl-6 font-semibold">Élève</TableHead>
                      <TableHead className="font-semibold">Nom</TableHead>
                      <TableHead className="font-semibold">Prénom</TableHead>
                      <TableHead className="font-semibold">NISU</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="pr-6 text-right font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEnrollments.map(student => {
                      const nisuOk = isNisuValid(student.nisu)
                      return (
                        <TableRow key={student.enrollmentId}>
                          <TableCell className="pl-6">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-muted text-muted-foreground">
                                <UserIcon className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {student.lastname}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {student.firstname}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "font-mono text-xs tabular-nums",
                                nisuOk ? "text-foreground" : "text-destructive font-medium"
                              )}
                            >
                              {student.nisu || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {nisuOk ? (
                              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                Valide
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Invalide</Badge>
                            )}
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isArchived || !nisuOk}
                              onClick={() => handleGenerateBulletin(student)}
                            >
                              <FileTextIcon className="mr-1 h-3 w-3" />
                              Générer
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>

            {/* Pagination footer — affiché uniquement si > 15 élèves */}
            {filteredEnrollments.length > 15 && (
              <>
                <Separator />
                <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">
                      Page <span className="font-medium text-foreground tabular-nums">{currentPage}</span>{" "}
                      sur <span className="font-medium text-foreground tabular-nums">{totalPages}</span>
                      {" "}&middot; {filteredEnrollments.length} élève(s)
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Afficher</span>
                      <Select
                        value={String(itemsPerPage)}
                        onValueChange={v => setItemsPerPage(Number(v))}
                      >
                        <SelectTrigger className="h-8 w-[72px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map(size => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <Pagination className="mx-0 w-auto justify-end">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={e => { e.preventDefault(); if (currentPage > 1) setCurrentPage(p => p - 1) }}
                            className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                        {paginationWindow.map((p, idx) => {
                          if (typeof p === 'string') {
                            return (
                              <PaginationItem key={`${p}-${idx}`}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )
                          }
                          return (
                            <PaginationItem key={p}>
                              <PaginationLink
                                href="#"
                                isActive={currentPage === p}
                                onClick={e => { e.preventDefault(); setCurrentPage(p) }}
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        })}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={e => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(p => p + 1) }}
                            className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {/* Div caché pour capture lot PDF */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, background: 'white' }}>
        <div ref={lotRef}>
          {lotData && <BulletinScolaire data={lotData} />}
        </div>
      </div>

      {/* PDF Generator Modal — individuel */}
      {pdfStudent && selectedStepObj && (
        <BulletinPDFGenerator
          open={pdfOpen}
          onOpenChange={(open) => {
            setPdfOpen(open)
            if (!open) setPdfStudent(null)
          }}
          studentId={pdfStudent.studentId}
          studentName={`${pdfStudent.lastname} ${pdfStudent.firstname}`}
          classSessionId={pdfStudent.classSessionId}
          stepId={selectedStep}
          stepName={selectedStepObj.name}
          className={pdfStudent.className}
          enrollmentId={pdfStudent.enrollmentId}
          yearId={academicYearId}
          stepIsCurrent={selectedStepObj.isCurrent}
        />
      )}
    </div>
  )
}
