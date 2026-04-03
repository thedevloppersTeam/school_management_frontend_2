"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatCard } from "@/components/school/stat-card"
import { BulletinPDFGenerator } from "@/components/bulletin-pdf-generator"
import { AlertTriangleIcon, CheckCircleIcon, FileTextIcon, AlertCircleIcon, UserIcon } from "lucide-react"
import {
  fetchSteps,
  fetchClassSessions,
  getClassSessionName,
  type AcademicYearStep,
  type ClassSession,
} from "@/lib/api/dashboard"

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnrollmentRow {
  enrollmentId: string
  studentId: string
  studentCode: string
  nisu: string
  firstname: string
  lastname: string
  classSessionId: string
  className: string
  status: string
}

interface CPMSLBulletinsSectionProps {
  academicYearId: string
  isArchived?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNisuValid(nisu: string): boolean {
  return !!nisu && /^\d{12,13}$/.test(nisu.trim())
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function CPMSLBulletinsSection({
  academicYearId,
  isArchived = false,
}: CPMSLBulletinsSectionProps) {
  // ── Données ──────────────────────────────────────────────────────────────────
  const [steps, setSteps]         = useState<AcademicYearStep[]>([])
  const [sessions, setSessions]   = useState<ClassSession[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [loadingInit, setLoadingInit]   = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)

  // ── Sélections ───────────────────────────────────────────────────────────────
  const [selectedStep, setSelectedStep]       = useState("")
  const [selectedSession, setSelectedSession] = useState("")

  // ── PDF Generator ─────────────────────────────────────────────────────────────
  const [pdfOpen, setPdfOpen]           = useState(false)
  const [pdfStudent, setPdfStudent]     = useState<EnrollmentRow | null>(null)

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

      const session = sessions.find(s => s.id === sessionId)
      const className = session ? getClassSessionName(session) : ''

      setEnrollments(data.map(enr => ({
        enrollmentId: enr.id,
        studentId: enr.studentId,
        studentCode: enr.student?.studentCode || '—',
        nisu: enr.student?.nisu || '',
        firstname: enr.student?.user?.firstname || '',
        lastname: enr.student?.user?.lastname || '',
        classSessionId: sessionId,
        className,
        status: enr.status,
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
  const withNisu    = enrollments.filter(e => isNisuValid(e.nisu))
  const withoutNisu = enrollments.filter(e => !isNisuValid(e.nisu))
  const selectedStepObj = steps.find(s => s.id === selectedStep)

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

  return (
    <div className="space-y-6">

      {/* Sélecteurs */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #E8E6E3' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: '#3A4A57' }}>
            Sélection de la classe et de l&apos;étape
          </h3>
        </div>
        <div style={{ padding: '24px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Étape */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17', display: 'block', marginBottom: '8px' }}>
                Étape
              </label>
              <Select value={selectedStep} onValueChange={setSelectedStep}>
                <SelectTrigger style={{ borderColor: '#D1CECC', borderRadius: '8px' }}>
                  <SelectValue placeholder="Sélectionner une étape" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map(step => (
                    <SelectItem key={step.id} value={step.id}>
                      {step.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Classe */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17', display: 'block', marginBottom: '8px' }}>
                Classe
              </label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger style={{ borderColor: '#D1CECC', borderRadius: '8px' }}>
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
          </div>
        </div>
      </div>

      {/* Contenu si sélections faites */}
      {selectedStep && selectedSession && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Élèves" value={enrollments.length} icon={AlertCircleIcon} iconBgColor="#F0F4F7" iconColor="#5A7085" />
            <StatCard label="NISU valides" value={withNisu.length} icon={CheckCircleIcon} iconBgColor="#E8F5EC" iconColor="#2D7D46" />
            <StatCard label="NISU manquants" value={withoutNisu.length} icon={AlertTriangleIcon} iconBgColor="#FEF6E0" iconColor="#C48B1A" />
            <StatCard label="Étape" value={selectedStepObj?.name || '—'} icon={FileTextIcon} iconBgColor="#E3EFF9" iconColor="#2B6CB0" />
          </div>

          {/* Table élèves */}
          {loadingStudents ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #E8E6E3' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#3A4A57' }}>
                  Liste des élèves — {sessions.find(s => s.id === selectedSession) ? getClassSessionName(sessions.find(s => s.id === selectedSession)!) : ''}
                </h3>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
                  <Table>
                    <TableHeader>
                      <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                        {['Photo', 'Nom', 'Prénom', 'NISU', 'Statut NISU', 'Action'].map(h => (
                          <TableHead key={h} style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2C4A6E' }}>
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} style={{ textAlign: 'center', color: '#78756F', padding: '32px' }}>
                            Aucun élève actif dans cette classe
                          </TableCell>
                        </TableRow>
                      ) : (
                        enrollments.map(student => {
                          const nisuOk = isNisuValid(student.nisu)
                          return (
                            <TableRow key={student.enrollmentId} style={{ borderBottom: '1px solid #E8E6E3' }} className="hover:bg-[#FAF8F3]">
                              <TableCell>
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback style={{ backgroundColor: '#F0F4F7', color: '#5A7085', fontSize: '12px' }}>
                                    <UserIcon className="h-4 w-4" />
                                  </AvatarFallback>
                                </Avatar>
                              </TableCell>
                              <TableCell style={{ fontWeight: 600, color: '#1E1A17', fontSize: '14px' }}>
                                {student.lastname}
                              </TableCell>
                              <TableCell style={{ color: '#1E1A17', fontSize: '14px' }}>
                                {student.firstname}
                              </TableCell>
                              <TableCell style={{ fontFamily: 'monospace', fontSize: '13px', color: nisuOk ? '#1E1A17' : '#C43C3C' }}>
                                {student.nisu || '—'}
                              </TableCell>
                              <TableCell>
                                {nisuOk ? (
                                  <Badge style={{ backgroundColor: '#E8F5EC', color: '#2D7D46', border: 'none' }}>Valide</Badge>
                                ) : (
                                  <Badge style={{ backgroundColor: '#FDE8E8', color: '#C43C3C', border: 'none' }}>Invalide</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  disabled={isArchived || !nisuOk}
                                  onClick={() => handleGenerateBulletin(student)}
                                  style={{
                                    backgroundColor: isArchived || !nisuOk ? '#E8E6E3' : '#2C4A6E',
                                    color: isArchived || !nisuOk ? '#A8A5A2' : 'white',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <FileTextIcon className="mr-1 h-3 w-3" />
                                  Générer
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {(!selectedStep || !selectedSession) && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', fontWeight: 500, color: '#78756F' }}>
            Sélectionnez une étape et une classe pour commencer la génération des bulletins
          </p>
        </div>
      )}

      {/* PDF Generator Modal */}
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
        />
      )}
    </div>
  )
}