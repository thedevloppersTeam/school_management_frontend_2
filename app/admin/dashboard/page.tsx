"use client"

import { useState, useEffect, Suspense } from "react"
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
  InfoIcon,
  LoaderIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/school/dashboard/stat-card"
import {
  fetchActiveAcademicYear,
  fetchSteps,
  fetchClassSessions,
  fetchEnrollmentCount,
  getCurrentStep,
  getClassSessionName,
  type AcademicYear,
  type AcademicYearStep,
  type ClassSession,
} from "@/lib/api/dashboard"

// ── Types locaux ──────────────────────────────────────────────────────────────

interface ClassRow {
  id: string
  name: string
  enrollmentCount: number
}

interface DashboardState {
  loading: boolean
  error: string | null
  activeYear: AcademicYear | null
  currentStep: AcademicYearStep | null
  totalStudents: number
  classSessions: ClassSession[]
  classRows: ClassRow[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const router = useRouter()

  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: null,
    activeYear: null,
    currentStep: null,
    totalStudents: 0,
    classSessions: [],
    classRows: [],
  })

  useEffect(() => {
    async function loadDashboard() {
      try {
        // 1. Année active
        const activeYear = await fetchActiveAcademicYear()
        console.log('[loadDashboard] Active academic year:', activeYear)

        if (!activeYear) {
          setState(s => ({ ...s, loading: false, activeYear: null }))
          return
        }

        // 2. Étapes + sessions de classe (en parallèle)
        const [steps, classSessions] = await Promise.all([
          fetchSteps(activeYear.id),
          fetchClassSessions(activeYear.id),
        ])

        const currentStep = getCurrentStep(steps)

        // 3. Effectifs par classe (en parallèle)
        const enrollmentCounts = await Promise.all(
          classSessions.map(s => fetchEnrollmentCount(s.id))
        )

        const classRows: ClassRow[] = classSessions.map((session, i) => ({
          id: session.id,
          name: getClassSessionName(session),
          enrollmentCount: enrollmentCounts[i],
        }))

        const totalStudents = enrollmentCounts.reduce((sum, n) => sum + n, 0)

        setState({
          loading: false,
          error: null,
          activeYear,
          currentStep,
          totalStudents,
          classSessions,
          classRows,
        })
      } catch (err) {
        setState(s => ({
          ...s,
          loading: false,
          error: "Impossible de charger les données. Vérifiez votre connexion.",
        }))
      }
    }

    loadDashboard()
  }, [])

  const { loading, error, activeYear, currentStep, totalStudents, classRows } = state

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <h1
          className="font-serif"
          style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#2A3740" }}
        >
          Tableau de bord
        </h1>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
          <div style={{ textAlign: "center" }}>
            <LoaderIcon
              className="h-8 w-8"
              style={{ color: "#5A7085", animation: "spin 1s linear infinite", margin: "0 auto 12px" }}
            />
            <p className="font-sans" style={{ fontSize: "14px", color: "#78756F" }}>
              Chargement des données...
            </p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <h1
          className="font-serif"
          style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#2A3740" }}
        >
          Tableau de bord
        </h1>
        <Card className="border border-[#E8E6E3] rounded-[10px]" style={{ backgroundColor: "white" }}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangleIcon className="h-10 w-10 mb-4" style={{ color: "#C43C3C" }} />
            <p className="font-sans" style={{ fontSize: "14px", color: "#C43C3C", textAlign: "center" }}>
              {error}
            </p>
            <Button
              className="mt-6"
              style={{ backgroundColor: "#5A7085", color: "white" }}
              onClick={() => window.location.reload()}
            >
              Réessayer
            </Button>
          </CardContent>
          
        </Card>
      </div>
    )
  }

  // ── Alertes ───────────────────────────────────────────────────────────────
  const alerts: Array<{ type: "warning" | "error" | "info"; message: string }> = []

  if (!activeYear) {
    alerts.push({ type: "info", message: "Aucune année scolaire active — configurez une année." })
  }
  if (activeYear && !currentStep) {
    alerts.push({ type: "info", message: "Aucune étape en cours — vérifiez les dates des étapes." })
  }
  if (classRows.length === 0 && activeYear) {
    alerts.push({ type: "warning", message: "Aucune classe configurée pour cette année scolaire." })
  }

  const alertColors = {
    warning: { bg: "#FEF6E0", text: "#C48B1A" },
    error:   { bg: "#FDE8E8", text: "#C43C3C" },
    info:    { bg: "#E3EFF9", text: "#2B6CB0" },
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Titre */}
      <h1
        className="font-serif"
        style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#2A3740" }}
      >
        Tableau de bord
      </h1>

      {/* ── KPI Cards ── */}
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
          value={classRows.length}
          icon={SchoolIcon}
          iconBgColor="#FAF8F3"
          iconColor="#B0A07A"
        />
        <StatCard
          label="Étape en cours"
          value={currentStep?.name || "Aucune étape"}
          icon={BarChart3Icon}
          iconBgColor="#E3EFF9"
          iconColor="#2B6CB0"
        />
      </div>

      {/* ── Actions rapides + Alertes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Actions rapides */}
        <Card
          className="border border-[#E8E6E3] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "white" }}
        >
          <CardHeader>
            <CardTitle
              className="font-serif"
              style={{ fontSize: "20px", fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.02em", color: "#3A4A57" }}
            >
              Actions rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              {
                label: `Saisir des notes${currentStep ? ` — ${currentStep.name}` : ""}`,
                icon: ClipboardEditIcon,
                href: `/admin/academic-year/${activeYear?.id}/grades`,
                disabled: !activeYear,
              },
              {
                label: `Générer bulletins${currentStep ? ` — ${currentStep.name}` : ""}`,
                icon: FileTextIcon,
                href: `/admin/academic-year/${activeYear?.id}/reports`,
                disabled: !activeYear,
              },
              {
                label: "Inscrire un nouvel élève",
                icon: UserPlusIcon,
                href: `/admin/academic-year/${activeYear?.id}/students`,
                disabled: !activeYear,
              },
            ].map(action => {
              const Icon = action.icon
              return (
                <Button
                  key={action.label}
                  variant="outline"
                  disabled={action.disabled}
                  className="w-full justify-start text-left h-auto py-3 px-4 rounded-lg border"
                  style={{ backgroundColor: "#F0F4F7", color: "#5A7085", borderColor: "#D9E3EA" }}
                  onClick={() => !action.disabled && router.push(action.href)}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  <span className="font-sans" style={{ fontSize: "14px", fontWeight: 500, lineHeight: 1.5 }}>
                    {action.label}
                  </span>
                </Button>
              )
            })}
          </CardContent>
        </Card>

        {/* Alertes */}
        <Card
          className="border border-[#E8E6E3] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "white" }}
        >
          <CardHeader>
            <CardTitle
              className="font-serif"
              style={{ fontSize: "20px", fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.02em", color: "#3A4A57" }}
            >
              Alertes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <div
                className="font-sans text-center py-6"
                style={{ fontSize: "14px", color: "#A8A39C" }}
              >
                Aucune alerte en cours
              </div>
            ) : (
              alerts.map((alert, i) => {
                const colors = alertColors[alert.type]
                return (
                  <div
                    key={i}
                    className="font-sans rounded-md p-3 flex items-center gap-2"
                    style={{ fontSize: "14px", fontWeight: 500, backgroundColor: colors.bg, color: colors.text }}
                  >
                    <InfoIcon className="h-4 w-4 flex-shrink-0" />
                    <span>{alert.message}</span>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tableau des classes ── */}
      {classRows.length === 0 ? (
        <Card
          className="border border-[#E8E6E3] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "white" }}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <SchoolIcon className="h-12 w-12 mb-4" style={{ color: "#A8A39C" }} />
            <h3 className="font-serif mb-2" style={{ fontSize: "20px", fontWeight: 600, color: "#3A4A57" }}>
              Aucune classe configurée
            </h3>
            <p className="font-sans mb-6 text-center" style={{ fontSize: "14px", color: "#78756F" }}>
              Configurez l&apos;année scolaire pour voir les statistiques des classes.
            </p>
            <Button
              onClick={() => router.push("/admin/academic-years")}
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
            <div className="flex items-center justify-between">
              <CardTitle
                className="font-serif"
                style={{ fontSize: "20px", fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.02em", color: "#3A4A57" }}
              >
                Classes — {activeYear?.name}
              </CardTitle>
              <Badge style={{ backgroundColor: "#F0F4F7", color: "#5A7085", border: "none" }}>
                {classRows.length} classe{classRows.length > 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr style={{ backgroundColor: "#F0F4F7" }}>
                    {["Classe", "Effectif", "Étape en cours"].map(col => (
                      <th
                        key={col}
                        className="text-left py-3 px-4 font-sans uppercase"
                        style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.04em", color: "#4A5D6E" }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#E8E6E3] hover:bg-[#FAF8F3] transition-colors cursor-pointer"
                      style={{ backgroundColor: index % 2 === 0 ? "#FAFAF8" : "white" }}
                      onClick={() => router.push(`/admin/academic-year/${activeYear?.id}/grades`)}
                    >
                      <td
                        className="py-3 px-4 font-sans"
                        style={{ fontSize: "14px", fontWeight: 500, color: "#1E1A17" }}
                      >
                        {row.name}
                      </td>
                      <td
                        className="py-3 px-4 font-sans"
                        style={{ fontSize: "14px", color: "#5C5955" }}
                      >
                        {row.enrollmentCount} élève{row.enrollmentCount > 1 ? "s" : ""}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          style={{
                            backgroundColor: currentStep ? "#E8F5EC" : "#F0F4F7",
                            color: currentStep ? "#2D7D46" : "#78756F",
                            border: "none",
                          }}
                        >
                          {currentStep?.name || "Aucune étape"}
                        </Badge>
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