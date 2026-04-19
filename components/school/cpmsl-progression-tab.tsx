"use client"

import { clientFetch as apiFetch } from '@/lib/client-fetch'
import { useState, useEffect, useCallback } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircleIcon, AlertCircleIcon, ClockIcon } from "lucide-react"
import type { AcademicYearStep, ClassSession } from "@/lib/api/dashboard"
import { fetchClassSubjects, fetchEnrollments } from "@/lib/api/grades"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassProgress {
  sessionId: string
  className: string
  totalExpected: number   // enrollments × class-subjects
  totalEntered: number    // grades effectivement saisies
  pct: number             // 0-100
  status: 'complete' | 'in-progress' | 'not-started'
}

interface CPMSLProgressionTabProps {
  yearId: string
  sessions: ClassSession[]
  steps: AcademicYearStep[]
  onNavigateToSaisie?: (sessionId: string, stepId: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sessionLabel(s: ClassSession): string {
  const { classType, letter, track } = s.class
  const base = `${classType.name} ${letter}`
  return track ? `${base} — ${track.code}` : base
}


// ── Composant ─────────────────────────────────────────────────────────────────

export function CPMSLProgressionTab({
  yearId,
  sessions,
  steps,
  onNavigateToSaisie,
}: CPMSLProgressionTabProps) {
  const [selectedStep, setSelectedStep]         = useState("")
  const [classProgress, setClassProgress]       = useState<ClassProgress[]>([])
  const [loading, setLoading]                   = useState(false)

  // ── Chargement ───────────────────────────────────────────────────────────────
  const loadProgress = useCallback(async (stepId: string) => {
    if (!stepId || sessions.length === 0) return
    setLoading(true)
    setClassProgress([])

    try {
      const results = await Promise.all(
        sessions.map(async (session): Promise<ClassProgress> => {
          try {
            // 1. Matières assignées + inscriptions en parallèle
            const [classSubjects, enrollments] = await Promise.all([
              fetchClassSubjects(session.id),
              fetchEnrollments(session.id),
            ])

            if (classSubjects.length === 0 || enrollments.length === 0) {
              return {
                sessionId: session.id,
                className: sessionLabel(session),
                totalExpected: 0,
                totalEntered: 0,
                pct: 0,
                status: 'not-started',
              }
            }

            // 2. Compter les notes saisies pour chaque matière
            const gradesCounts = await Promise.all(
              classSubjects.map(async (cs) => {
                try {
                  const grades = await apiFetch<Array<{ id: string }>>(
                    `/api/grades/class-subject/${cs.id}/step/${stepId}`
                  )
                  return grades.length
                } catch {
                  return 0
                }
              })
            )

            const totalEntered  = gradesCounts.reduce((s, v) => s + v, 0)
            const totalExpected = classSubjects.length * enrollments.length
            const pct = totalExpected > 0
              ? Math.round((totalEntered / totalExpected) * 100)
              : 0

            const status: ClassProgress['status'] =
              pct === 100 ? 'complete' :
              pct > 0     ? 'in-progress' :
              'not-started'

            return {
              sessionId:     session.id,
              className:     sessionLabel(session),
              totalExpected,
              totalEntered,
              pct,
              status,
            }
          } catch {
            return {
              sessionId: session.id,
              className: sessionLabel(session),
              totalExpected: 0,
              totalEntered:  0,
              pct:           0,
              status:        'not-started',
            }
          }
        })
      )

      // Trier : complètes en bas, non-commencées en haut
      results.sort((a, b) => {
        const order = { 'not-started': 0, 'in-progress': 1, 'complete': 2 }
        return order[a.status] - order[b.status]
      })

      setClassProgress(results)
    } catch (err) {
      console.error('[progression] erreur:', err)
    } finally {
      setLoading(false)
    }
  }, [sessions])

  useEffect(() => {
    if (selectedStep) loadProgress(selectedStep)
    else setClassProgress([])
  }, [selectedStep, loadProgress])

  // ── KPIs globaux ─────────────────────────────────────────────────────────────
  const totalExpected = classProgress.reduce((s, c) => s + c.totalExpected, 0)
  const totalEntered  = classProgress.reduce((s, c) => s + c.totalEntered,  0)
  const globalPct     = totalExpected > 0 ? Math.round((totalEntered / totalExpected) * 100) : 0
  const complete      = classProgress.filter(c => c.status === 'complete').length
  const inProgress    = classProgress.filter(c => c.status === 'in-progress').length
  const notStarted    = classProgress.filter(c => c.status === 'not-started').length

  // ── Couleur barre ─────────────────────────────────────────────────────────────
  const barColor = (pct: number) =>
    pct === 100 ? '#2D7D46' : pct > 0 ? '#2B6CB0' : '#D1CECC'

  const statusBadge = (status: ClassProgress['status']) => {
    if (status === 'complete')    return { bg: '#E8F5EC', color: '#2D7D46',  icon: <CheckCircleIcon className="h-3.5 w-3.5" />, label: 'Complet' }
    if (status === 'in-progress') return { bg: '#E3EFF9', color: '#2B6CB0',  icon: <ClockIcon className="h-3.5 w-3.5" />,         label: 'En cours' }
    return                               { bg: '#F5F4F2', color: '#78756F',  icon: <AlertCircleIcon className="h-3.5 w-3.5" />,  label: 'Non commencé' }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Sélecteur étape */}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: '#3A4A57' }}>
            Sélectionner une étape
          </h3>
        </div>
        <div style={{ padding: '24px' }}>
          <Select value={selectedStep} onValueChange={setSelectedStep}>
            <SelectTrigger style={{ borderColor: '#D1CECC', borderRadius: '8px', maxWidth: '280px' }}>
              <SelectValue placeholder="Choisir une étape" />
            </SelectTrigger>
            <SelectContent>
              {steps.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty state */}
      {!selectedStep && (
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', fontWeight: 500, color: '#78756F' }}>
            Sélectionnez une étape pour voir l&apos;avancement de la saisie
          </p>
        </div>
      )}

      {/* Loading */}
      {selectedStep && loading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {/* Contenu */}
      {selectedStep && !loading && classProgress.length > 0 && (
        <>
          {/* Barre globale */}
          <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>
                Avancement global — {steps.find(s => s.id === selectedStep)?.name}
              </h3>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 700, color: globalPct === 100 ? '#2D7D46' : '#2C4A6E' }}>
                {globalPct}%
              </span>
            </div>
            {/* Barre de progression */}
            <div style={{ backgroundColor: '#F0F4F7', borderRadius: '8px', height: '16px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ width: `${globalPct}%`, height: '100%', backgroundColor: barColor(globalPct), borderRadius: '8px', transition: 'width 0.5s ease' }} />
            </div>
            <p style={{ fontSize: '13px', color: '#78756F' }}>
              {totalEntered} / {totalExpected} notes saisies
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Classes complètes',     value: complete,    color: '#2D7D46', bg: '#E8F5EC' },
              { label: 'Classes en cours',       value: inProgress,  color: '#2B6CB0', bg: '#E3EFF9' },
              { label: 'Classes non commencées', value: notStarted,  color: '#78756F', bg: '#F5F4F2' },
            ].map(kpi => (
              <div key={kpi.label} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '16px 20px' }}>
                <p style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#78756F', marginBottom: '6px' }}>
                  {kpi.label}
                </p>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 700, color: kpi.color }}>
                  {kpi.value}
                  <span style={{ fontSize: '14px', fontWeight: 400, color: '#78756F', marginLeft: '6px' }}>
                    / {classProgress.length}
                  </span>
                </p>
              </div>
            ))}
          </div>

          {/* Tableau par classe */}
          <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: '#2A3740' }}>
                Détail par classe
              </h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  {['Classe', 'Progression', '%', 'Notes', 'Statut', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Progression' ? 'left' : 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2C4A6E' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classProgress.map((cp, i) => {
                  const badge = statusBadge(cp.status)
                  return (
                    <tr key={cp.sessionId} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAF8' }} className="hover:bg-[#F5F4F2]">
                      {/* Classe */}
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#1E1A17', minWidth: '160px' }}>
                        {cp.className}
                      </td>

                      {/* Barre */}
                      <td style={{ padding: '12px 16px', minWidth: '200px' }}>
                        <div style={{ backgroundColor: '#F0F4F7', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                          <div style={{ width: `${cp.pct}%`, height: '100%', backgroundColor: barColor(cp.pct), borderRadius: '6px', transition: 'width 0.4s ease' }} />
                        </div>
                      </td>

                      {/* % */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: barColor(cp.pct) }}>
                        {cp.pct}%
                      </td>

                      {/* Notes */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', color: '#78756F' }}>
                        {cp.totalEntered} / {cp.totalExpected}
                      </td>

                      {/* Statut */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {cp.status !== 'complete' && onNavigateToSaisie && (
                          <button
                            onClick={() => onNavigateToSaisie(cp.sessionId, selectedStep)}
                            style={{ fontSize: '12px', fontWeight: 500, color: '#2C4A6E', background: 'none', border: '1px solid #B3C7D5', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}
                          >
                            Saisir →
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}