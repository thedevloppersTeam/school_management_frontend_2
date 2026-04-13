"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { BulletinPDFGenerator } from "@/components/bulletin-pdf-generator"
import { SearchIcon, ArchiveIcon, ClockIcon, UserIcon } from "lucide-react"
import { fetchActiveAcademicYear, fetchClassSessions, fetchSteps, getClassSessionName, type AcademicYear, type ClassSession, type AcademicYearStep } from "@/lib/api/dashboard"
import type { BulletinData } from "@/components/BulletinScolaire"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArchiveRow {
  id:           string
  enrollmentId: string
  stepId:       string
  version:      number
  nisu:         string
  studentName:  string
  className:    string
  academicYear: string
  stepName:     string
  status:       'GENERATED' | 'CORRECTED' | 'SUPERSEDED'
  isActive:     boolean
  isCorrection: boolean
  auditNote:    string | null
  generatedAt:  string
  source:       'individual' | 'batch'
  bulletinSnapshot?: BulletinData
  generatedByUser: { firstname: string; lastname: string }
  enrollment: {
    classSessionId: string
    student: { id: string }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusBadge(status: ArchiveRow['status'], isActive: boolean) {
  if (!isActive) return { label: 'Remplacé',  bg: '#F3F4F6', color: '#6B7280' }
  if (status === 'CORRECTED')  return { label: 'Correction', bg: '#FEF6E0', color: '#C48B1A' }
  return { label: 'Généré',   bg: '#E8F5EC', color: '#2D7D46' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ArchivesPage() {
  const router = useRouter()

  // ── Contexte ─────────────────────────────────────────────────────────────
  const [activeYear,  setActiveYear]  = useState<AcademicYear | null>(null)
  const [sessions,    setSessions]    = useState<ClassSession[]>([])
  const [steps,       setSteps]       = useState<AcademicYearStep[]>([])
  const [loadingCtx,  setLoadingCtx]  = useState(true)

  // ── Filtres ───────────────────────────────────────────────────────────────
  const [filterSession, setFilterSession] = useState("")
  const [filterStep,    setFilterStep]    = useState("")
  const [filterNisu,    setFilterNisu]    = useState("")

  // ── Archives ──────────────────────────────────────────────────────────────
  const [archives,     setArchives]     = useState<ArchiveRow[]>([])
  const [loadingList,  setLoadingList]  = useState(false)

  // ── Panel versions ────────────────────────────────────────────────────────
  const [versionsOpen,    setVersionsOpen]    = useState(false)
  const [selectedArchive, setSelectedArchive] = useState<ArchiveRow | null>(null)
  const [versions,        setVersions]        = useState<ArchiveRow[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // ── Régénération depuis snapshot ──────────────────────────────────────────
  const [pdfOpen,    setPdfOpen]    = useState(false)
  const [pdfArchive, setPdfArchive] = useState<ArchiveRow | null>(null)

  // ── Chargement contexte ───────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const year = await fetchActiveAcademicYear()
        setActiveYear(year)
        if (year) {
          const [sess, stps] = await Promise.all([
            fetchClassSessions(year.id),
            fetchSteps(year.id),
          ])
          setSessions(sess)
          setSteps([...stps].sort((a, b) => a.stepNumber - b.stepNumber))
        }
      } catch (err) {
        console.error('[archives] init:', err)
      } finally {
        setLoadingCtx(false)
      }
    }
    init()
  }, [])

  // ── Chargement archives ───────────────────────────────────────────────────
  const loadArchives = useCallback(async () => {
    if (!activeYear) return
    setLoadingList(true)
    try {
      const params = new URLSearchParams()
      params.set('academicYearId', activeYear.id)
      if (filterSession) params.set('classSessionId', filterSession)
      if (filterStep)    params.set('stepId', filterStep)
      if (filterNisu)    params.set('nisu', filterNisu)

      const data = await apiFetch<ArchiveRow[]>(`/api/bulletin-archives?${params}`)
      setArchives(data)
    } catch (err) {
      console.error('[archives] load:', err)
    } finally {
      setLoadingList(false)
    }
  }, [activeYear, filterSession, filterStep, filterNisu])

  useEffect(() => { loadArchives() }, [loadArchives])

  // ── Chargement versions ───────────────────────────────────────────────────
  const openVersions = async (archive: ArchiveRow) => {
    setSelectedArchive(archive)
    setVersionsOpen(true)
    setLoadingVersions(true)
    try {
      const data = await apiFetch<ArchiveRow[]>(
        `/api/bulletin-archives/${archive.enrollmentId}/${archive.stepId}`
      )
      setVersions(data)
    } catch (err) {
      console.error('[archives] versions:', err)
    } finally {
      setLoadingVersions(false)
    }
  }

  // ── Ouvrir PDF depuis snapshot ────────────────────────────────────────────
  const openPdfFromSnapshot = (archive: ArchiveRow) => {
    setPdfArchive(archive)
    setPdfOpen(true)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadingCtx) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Archives
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique de tous les bulletins générés — {activeYear?.name}
        </p>
      </div>

      {/* Filtres */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select value={filterSession || 'all'} onValueChange={v => setFilterSession(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>{getClassSessionName(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStep || 'all'} onValueChange={v => setFilterStep(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les étapes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les étapes</SelectItem>
                {steps.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par NISU..."
                value={filterNisu}
                onChange={e => setFilterNisu(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loadingList ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : archives.length === 0 ? (
        <Card className="border bg-card py-16 text-center shadow-sm">
          <CardContent className="flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ArchiveIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Aucun bulletin archivé
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border bg-card shadow-sm">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Élève', 'NISU', 'Classe', 'Étape', 'Version', 'Statut', 'Généré par', 'Date', 'Actions'].map(h => (
                    <TableHead key={h} className="font-semibold">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
              {archives.map((archive) => {
                const badge = statusBadge(archive.status, archive.isActive)
                return (
                  <TableRow key={archive.id}>
                    <TableCell className="font-medium">
                      {archive.studentName}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {archive.nisu}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {archive.className}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {archive.stepName}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-bold text-foreground">v{archive.version}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={
                        badge.label === 'Généré' ? 'bg-emerald-100 text-emerald-700' :
                        badge.label === 'Correction' ? 'bg-amber-100 text-amber-700' :
                        ''
                      }>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {archive.generatedByUser.firstname} {archive.generatedByUser.lastname}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(archive.generatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => openVersions(archive)}>
                          Historique
                        </Button>
                        {archive.bulletinSnapshot && (
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs text-emerald-600" onClick={() => openPdfFromSnapshot(archive)}>
                            Voir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Panel versions */}
      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '560px' }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: '20px', fontWeight: 700, color: '#2A3740' }}>
              Historique — {selectedArchive?.studentName}
            </DialogTitle>
            <DialogDescription>
              {selectedArchive?.className} · {selectedArchive?.stepName} · {selectedArchive?.academicYear}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {loadingVersions ? (
              <div className="space-y-2">
                {[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : versions.map(v => {
              const badge = statusBadge(v.status, v.isActive)
              return (
                <div key={v.id} style={{ border: `1px solid ${v.isActive ? '#B3C7D5' : '#E8E6E3'}`, borderRadius: '8px', padding: '12px 16px', backgroundColor: v.isActive ? '#F0F4F7' : 'white' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#2C4A6E' }}>v{v.version}</span>
                        <Badge style={{ backgroundColor: badge.bg, color: badge.color, border: 'none', fontSize: '11px' }}>
                          {badge.label}
                        </Badge>
                        {v.source === 'batch' && (
                          <Badge style={{ backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none', fontSize: '11px' }}>
                            Lot
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1" style={{ fontSize: '12px', color: '#78756F' }}>
                        <ClockIcon className="h-3 w-3" />
                        {formatDate(v.generatedAt)}
                      </div>
                      <div className="flex items-center gap-1" style={{ fontSize: '12px', color: '#78756F' }}>
                        <UserIcon className="h-3 w-3" />
                        {v.generatedByUser.firstname} {v.generatedByUser.lastname}
                      </div>
                      {v.auditNote && (
                        <div style={{ fontSize: '12px', color: '#C48B1A', fontStyle: 'italic', marginTop: '4px' }}>
                          📝 {v.auditNote}
                        </div>
                      )}
                    </div>
                    {v.bulletinSnapshot && (
                      <button
                        onClick={() => { openPdfFromSnapshot(v); setVersionsOpen(false) }}
                        style={{ fontSize: '12px', fontWeight: 500, color: '#2D7D46', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Voir / Imprimer
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Generator depuis snapshot — Phase 4 */}
      {pdfArchive && pdfArchive.bulletinSnapshot && (
        <BulletinPDFGenerator
          open={pdfOpen}
          onOpenChange={(open) => {
            setPdfOpen(open)
            if (!open) setPdfArchive(null)
          }}
          studentId={pdfArchive.enrollment.student.id}
          studentName={pdfArchive.studentName}
          classSessionId={pdfArchive.enrollment.classSessionId}
          stepId={pdfArchive.stepId}
          stepName={pdfArchive.stepName}
          className={pdfArchive.className}
          enrollmentId={pdfArchive.enrollmentId}
          yearId={activeYear?.id ?? ''}
          snapshotData={pdfArchive.bulletinSnapshot}
          stepIsCurrent={false}
        />
      )}
    </div>
  )
}