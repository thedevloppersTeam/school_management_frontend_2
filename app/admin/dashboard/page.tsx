"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarIcon,
  UsersIcon,
  SchoolIcon,
  BarChart3Icon,
  ClipboardEditIcon,
  FileTextIcon,
  UserPlusIcon,
  AlertTriangleIcon,
  InfoIcon
} from "lucide-react"
import {
  fetchActiveAcademicYear,
  fetchSteps,
  fetchClassSessions,
  fetchEnrollmentCount,
  getCurrentStep,
  getClassSessionName,
  type AcademicYear,
  type AcademicYearStep,
  type ClassSession
} from "@/lib/api/dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/school/stat-card"
import { Skeleton } from "@/components/ui/skeleton"

interface SessionStat {
  sessionId: string
  className: string
  studentCount: number
}

export default function AdminDashboardPage() {
  const router = useRouter()

  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null)
  const [steps, setSteps] = useState<AcademicYearStep[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [sessionStats, setSessionStats] = useState<SessionStat[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const year = await fetchActiveAcademicYear()
        setActiveYear(year)

        if (!year) return

        const [stepsData, sessionsData] = await Promise.all([
          fetchSteps(year.id),
          fetchClassSessions(year.id),
        ])
        setSteps(stepsData)
        setSessions(sessionsData)

        // Compter les élèves par session en parallèle
        const counts = await Promise.all(
          sessionsData.map(async (s) => ({
            sessionId: s.id,
            className: getClassSessionName(s),
            studentCount: await fetchEnrollmentCount(s.id),
          }))
        )
        setSessionStats(counts)
        setTotalStudents(counts.reduce((sum, c) => sum + c.studentCount, 0))
      } catch (err) {
        console.error("[dashboard] Erreur chargement:", err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  
  const currentStep = getCurrentStep(steps)

  const renderAlertContent = () => {
    if (!activeYear) {
      return (
        <div
          className="font-sans rounded-md p-3 flex items-center gap-2"
          style={{ backgroundColor: "#FEF6E0", color: "#C48B1A", fontSize: "14px", fontWeight: 500 }}
        >
          <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
          <span>Aucune année scolaire active — configurez-en une</span>
        </div>
      )
    }

    if (!currentStep) {
      return (
        <div
          className="font-sans rounded-md p-3 flex items-center gap-2"
          style={{ backgroundColor: "#E3EFF9", color: "#2B6CB0", fontSize: "14px", fontWeight: 500 }}
        >
          <InfoIcon className="h-4 w-4 flex-shrink-0" />
          <span>Aucune étape active — configurez les étapes de l&apos;année</span>
        </div>
      )
    }

    if (sessions.length === 0) {
      return (
        <div
          className="font-sans rounded-md p-3 flex items-center gap-2"
          style={{ backgroundColor: "#FEF6E0", color: "#C48B1A", fontSize: "14px", fontWeight: 500 }}
        >
          <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
          <span>Aucune classe configurée pour cette année</span>
        </div>
      )
    }

    return (
      <div
        className="font-sans rounded-md p-3 flex items-center gap-2"
        style={{ backgroundColor: "#E8F5EC", color: "#2D7D46", fontSize: "14px", fontWeight: 500 }}
      >
        <span>
          {sessions.length} classe(s) · {totalStudents} élève(s) · Étape : {currentStep.name}
        </span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1
        className="font-serif"
        style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#2A3740" }}
      >
        Tableau de bord
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Année active"
          value={activeYear?.name || "Aucune année active"}
          icon={CalendarIcon}
          iconBgColor="#F0F4F7"
          iconColor="#5A7085"
        />
        <StatCard
          label="Élèves inscrits"
          value={totalStudents}
          icon={UsersIcon}
          iconBgColor="#E8F5EC"
          iconColor="#2D7D46"
        />
        <StatCard
          label="Classes"
          value={sessions.length}
          icon={SchoolIcon}
          iconBgColor="#FAF8F3"
          iconColor="#B0A07A"
        />
        <StatCard
          label="Étape en cours"
          value={currentStep?.name || "Aucune étape active"}
          icon={BarChart3Icon}
          iconBgColor="#E3EFF9"
          iconColor="#2B6CB0"
        />
      </div>

      {/* Actions rapides + Alertes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          className="border border-[#E8E6E3] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "white" }}
        >
          <CardHeader>
            <CardTitle
              className="font-serif"
              style={{ fontSize: "20px", fontWeight: 600, color: "#3A4A57" }}
            >
              Actions rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start text-left h-auto py-3 px-4 rounded-lg border"
              style={{ backgroundColor: "#F0F4F7", color: "#5A7085", borderColor: "#D9E3EA" }}
              onClick={() => router.push(`/admin/academic-year/${activeYear?.id}/grades`)}
              disabled={!activeYear}
            >
              <ClipboardEditIcon className="mr-3 h-5 w-5" />
              <span className="font-sans" style={{ fontSize: "14px", fontWeight: 500 }}>
                Saisir des notes — {currentStep?.name || "Aucune étape"}
              </span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-left h-auto py-3 px-4 rounded-lg border"
              style={{ backgroundColor: "#F0F4F7", color: "#5A7085", borderColor: "#D9E3EA" }}
              onClick={() => router.push(`/admin/academic-year/${activeYear?.id}/reports`)}
              disabled={!activeYear}
            >
              <FileTextIcon className="mr-3 h-5 w-5" />
              <span className="font-sans" style={{ fontSize: "14px", fontWeight: 500 }}>
                Générer bulletins — {currentStep?.name || "Aucune étape"}
              </span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-left h-auto py-3 px-4 rounded-lg border"
              style={{ backgroundColor: "#F0F4F7", color: "#5A7085", borderColor: "#D9E3EA" }}
              onClick={() => router.push(`/admin/academic-year/${activeYear?.id}/students`)}
              disabled={!activeYear}
            >
              <UserPlusIcon className="mr-3 h-5 w-5" />
              <span className="font-sans" style={{ fontSize: "14px", fontWeight: 500 }}>
                Inscrire un nouvel élève
              </span>
            </Button>
          </CardContent>
        </Card>

        <Card
          className="border border-[#E8E6E3] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "white" }}
        >
          <CardHeader>
            <CardTitle
              className="font-serif"
              style={{ fontSize: "20px", fontWeight: 600, color: "#3A4A57" }}
            >
              Alertes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!activeYear ? (
              <div
                className="font-sans rounded-md p-3 flex items-center gap-2"
                style={{ backgroundColor: "#FEF6E0", color: "#C48B1A", fontSize: "14px", fontWeight: 500 }}
              >
                <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
                <span>Aucune année scolaire active — configurez-en une</span>
              </div>
            ) : !currentStep ? (
              <div
                className="font-sans rounded-md p-3 flex items-center gap-2"
                style={{ backgroundColor: "#E3EFF9", color: "#2B6CB0", fontSize: "14px", fontWeight: 500 }}
              >
                <InfoIcon className="h-4 w-4 flex-shrink-0" />
                <span>Aucune étape active — configurez les étapes de l&apos;année</span>
              </div>
            ) : sessions.length === 0 ? (
              <div
                className="font-sans rounded-md p-3 flex items-center gap-2"
                style={{ backgroundColor: "#FEF6E0", color: "#C48B1A", fontSize: "14px", fontWeight: 500 }}
              >
                <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
                <span>Aucune classe configurée pour cette année</span>
              </div>
            ) : (
              <div
                className="font-sans rounded-md p-3 flex items-center gap-2"
                style={{ backgroundColor: "#E8F5EC", color: "#2D7D46", fontSize: "14px", fontWeight: 500 }}
              >
                <span>
                  {sessions.length} classe(s) · {totalStudents} élève(s) · Étape : {currentStep.name}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aperçu des classes */}
      {sessions.length === 0 ? (
        <Card
          className="border border-[#E8E6E3] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "white" }}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <SchoolIcon className="h-12 w-12 mb-4" style={{ color: "#A8A39C" }} />
            <h3 className="font-serif mb-2" style={{ fontSize: "20px", fontWeight: 600, color: "#3A4A57" }}>
              Aucune donnée disponible
            </h3>
            <p className="font-sans mb-6 text-center" style={{ fontSize: "14px", color: "#78756F" }}>
              Configurez l&apos;année scolaire pour voir les statistiques des classes.
            </p>
            <Button
              onClick={() => router.push('/admin/academic-years')}
              style={{ backgroundColor: "#5A7085", color: "white" }}
            >
              Configurer l&apos;année
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card
          className="border border-[#E8E6E3] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "white" }}
        >
          <CardHeader>
            <CardTitle
              className="font-serif"
              style={{ fontSize: "20px", fontWeight: 600, color: "#3A4A57" }}
            >
              Aperçu des classes — {activeYear?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#2C4A6E", textTransform: "uppercase", letterSpacing: "0.06em" }}>Classe</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#2C4A6E", textTransform: "uppercase", letterSpacing: "0.06em" }}>Élèves</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#2C4A6E", textTransform: "uppercase", letterSpacing: "0.06em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionStats.map((stat, i) => (
                    <tr
                      key={stat.sessionId}
                      style={{ borderTop: i > 0 ? "1px solid #E8E6E3" : "none", backgroundColor: "white" }}
                      className="hover:bg-[#FAF8F3]"
                    >
                      <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: 600, color: "#1E1A17" }}>
                        {stat.className}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#5C5955" }}>
                        {stat.studentCount} élève(s)
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/academic-year/${activeYear?.id}/grades`)}
                          style={{ fontSize: "13px", color: "#5A7085" }}
                        >
                          Saisir notes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}