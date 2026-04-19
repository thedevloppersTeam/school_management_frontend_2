"use client"

import { clientFetch as apiFetch } from '@/lib/client-fetch'
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
        <h1 className="font-serif" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.03em', color: '#2A3740' }}>
          Archives
        </h1>
        <p className="font-sans" style={{ fontSize: '13px', color: '#78756F' }}>
          Historique de tous les bulletins générés — {activeYear?.name}
        </p>
      </div>

      {/* Filtres */}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: '#3A4A57' }}>
            Filtres
          </h3>
        </div>
        <div style={{ padding: '24px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <Select value={filterSession || 'all'} onValueChange={v => setFilterSession(v === 'all' ? '' : v)}>
              <SelectTrigger style={{ borderColor: '#D1CECC', borderRadius: '8px' }}>
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
              <SelectTrigger style={{ borderColor: '#D1CECC', borderRadius: '8px' }}>
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
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#A8A5A2' }} />
              <Input
                placeholder="Rechercher par NISU..."
                value={filterNisu}
                onChange={e => setFilterNisu(e.target.value)}
                className="pl-9"
                style={{ borderColor: '#D1CECC' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loadingList ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : archives.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', padding: '48px 24px', textAlign: 'center' }}>
          <ArchiveIcon style={{ width: '48px', height: '48px', color: '#B3C7D5', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '15px', fontWeight: 500, color: '#78756F' }}>
            Aucun bulletin archivé
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                {['Élève', 'NISU', 'Classe', 'Étape', 'Version', 'Statut', 'Généré par', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2C4A6E' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {archives.map((archive, i) => {
                const badge = statusBadge(archive.status, archive.isActive)
                return (
                  <tr key={archive.id} style={{ borderBottom: i < archives.length - 1 ? '1px solid #E8E6E3' : 'none', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAF8' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#1E1A17' }}>
                      {archive.studentName}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#5A7085' }}>
                      {archive.nisu}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#5A7085' }}>
                      {archive.className}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#5A7085' }}>
                      {archive.stepName}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#2C4A6E' }}>v{archive.version}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge style={{ backgroundColor: badge.bg, color: badge.color, border: 'none', fontSize: '11px' }}>
                        {badge.label}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#5A7085' }}>
                      {archive.generatedByUser.firstname} {archive.generatedByUser.lastname}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#78756F' }}>
                      {formatDate(archive.generatedAt)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openVersions(archive)}
                          style={{ fontSize: '12px', fontWeight: 500, color: '#2B6CB0', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Historique
                        </button>
                        {archive.bulletinSnapshot && (
                          <>
                            <span style={{ color: '#D1CECC' }}>|</span>
                            <button
                              onClick={() => openPdfFromSnapshot(archive)}
                              style={{ fontSize: '12px', fontWeight: 500, color: '#2D7D46', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              Voir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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