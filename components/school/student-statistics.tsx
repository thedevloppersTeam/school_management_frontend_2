import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BarChartIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react"
import { type Student, type Period, type Grade, type Subject } from "@/lib/data/school-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface StudentStatisticsProps {
  student: Student
  allStudents: Student[]
  periods: Period[]
  grades: Grade[]
  subjects: Subject[]
  trigger?: React.ReactNode
}

export function StudentStatistics({ 
  student, 
  allStudents,
  periods, 
  grades, 
  subjects, 
  trigger 
}: StudentStatisticsProps) {
  const calculateAverage = (studentId: string, periodId?: string) => {
    const filteredGrades = periodId 
      ? grades.filter(g => g.studentId === studentId && g.periodId === periodId)
      : grades.filter(g => g.studentId === studentId)

    if (filteredGrades.length === 0) return 0

    let totalWeighted = 0
    let totalCoefficients = 0

    filteredGrades.forEach(grade => {
      const subject = subjects.find(s => s.id === grade.subjectId)
      if (subject) {
        const gradeValue = (grade.value / grade.maxValue) * 10
        totalWeighted += gradeValue * subject.coefficient
        totalCoefficients += subject.coefficient
      }
    })

    return totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0
  }

  const calculateRank = (periodId?: string) => {
    const classStudents = allStudents.filter(s => s.classroomId === student.classroomId)
    const averages = classStudents.map(s => ({
      id: s.id,
      average: calculateAverage(s.id, periodId)
    }))
    averages.sort((a, b) => b.average - a.average)
    const rank = averages.findIndex(a => a.id === student.id) + 1
    return { rank, total: classStudents.length }
  }

  const getEvolution = () => {
    const periodAverages = periods.map(p => ({
      period: p,
      average: calculateAverage(student.id, p.id)
    }))

    if (periodAverages.length < 2) return { trend: 'stable', value: 0 }

    const lastTwo = periodAverages.slice(-2)
    const diff = lastTwo[1].average - lastTwo[0].average

    if (diff > 0.5) return { trend: 'up', value: diff }
    if (diff < -0.5) return { trend: 'down', value: Math.abs(diff) }
    return { trend: 'stable', value: 0 }
  }

  const getSubjectStats = () => {
    return subjects.map(subject => {
      const subjectGrades = grades.filter(g => g.studentId === student.id && g.subjectId === subject.id)
      if (subjectGrades.length === 0) return null

      const avg = subjectGrades.reduce((sum, g) => sum + (g.value / g.maxValue) * 10, 0) / subjectGrades.length
      const best = Math.max(...subjectGrades.map(g => (g.value / g.maxValue) * 10))
      const worst = Math.min(...subjectGrades.map(g => (g.value / g.maxValue) * 10))

      return {
        subject,
        average: avg,
        best,
        worst,
        count: subjectGrades.length
      }
    }).filter(Boolean)
  }

  const getAppreciation = (average: number) => {
    if (average >= 9) return { text: 'Excellent', color: 'bg-green-500' }
    if (average >= 8) return { text: 'Très bien', color: 'bg-green-400' }
    if (average >= 7) return { text: 'Bien', color: 'bg-blue-500' }
    if (average >= 6) return { text: 'Assez bien', color: 'bg-blue-400' }
    if (average >= 5) return { text: 'Passable', color: 'bg-yellow-500' }
    return { text: 'Insuffisant', color: 'bg-red-500' }
  }

  const globalAverage = calculateAverage(student.id)
  const globalRank = calculateRank()
  const evolution = getEvolution()
  const subjectStats = getSubjectStats()

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="border-[#bebbb4]">
            <BarChartIcon className="mr-2 h-4 w-4" />
            Statistiques
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1f1a18]">
            Statistiques de {student.firstName} {student.lastName}
          </DialogTitle>
          <DialogDescription className="text-[#5b6d77]">
            Analyse détaillée des performances scolaires
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Vue d'ensemble */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-[#bebbb4]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-[#5b6d77]">Moyenne générale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-[#1f1a18]">
                      {globalAverage.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#5b6d77]">/ 10</p>
                  </div>
                  <Badge className={`${getAppreciation(globalAverage).color} text-white`}>
                    {getAppreciation(globalAverage).text}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#bebbb4]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-[#5b6d77]">Classement</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-[#1f1a18]">
                  {globalRank.rank}<span className="text-lg">e</span>
                </p>
                <p className="text-xs text-[#5b6d77]">sur {globalRank.total} élèves</p>
              </CardContent>
            </Card>

            <Card className="border-[#bebbb4]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-[#5b6d77]">Évolution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {evolution.trend === 'up' && (
                    <>
                      <TrendingUpIcon className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold text-green-500">+{evolution.value.toFixed(2)}</p>
                        <p className="text-xs text-[#5b6d77]">En progression</p>
                      </div>
                    </>
                  )}
                  {evolution.trend === 'down' && (
                    <>
                      <TrendingDownIcon className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold text-red-500">-{evolution.value.toFixed(2)}</p>
                        <p className="text-xs text-[#5b6d77]">En baisse</p>
                      </div>
                    </>
                  )}
                  {evolution.trend === 'stable' && (
                    <>
                      <MinusIcon className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold text-blue-500">Stable</p>
                        <p className="text-xs text-[#5b6d77]">Pas de changement</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Évolution par période */}
          <Card className="border-[#bebbb4]">
            <CardHeader>
              <CardTitle className="text-[#1f1a18]">Évolution par période</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {periods.map(period => {
                  const avg = calculateAverage(student.id, period.id)
                  const rank = calculateRank(period.id)
                  return (
                    <div key={period.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#1f1a18]">{period.name}</p>
                          <p className="text-xs text-[#5b6d77]">
                            Rang: {rank.rank}e / {rank.total}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#1f1a18]">{avg.toFixed(2)}</p>
                          <Badge className={`${getAppreciation(avg).color} text-white text-xs`}>
                            {getAppreciation(avg).text}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={(avg / 10) * 100} className="h-2" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Statistiques par matière */}
          <Card className="border-[#bebbb4]">
            <CardHeader>
              <CardTitle className="text-[#1f1a18]">Performance par matière</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subjectStats.map((stat: any) => (
                  <div key={stat.subject.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#1f1a18]">{stat.subject.name}</p>
                        <p className="text-xs text-[#5b6d77]">
                          {stat.count} note{stat.count > 1 ? 's' : ''} • Coef. {stat.subject.coefficient}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#1f1a18]">{stat.average.toFixed(2)}</p>
                        <p className="text-xs text-[#5b6d77]">
                          Min: {stat.worst.toFixed(1)} • Max: {stat.best.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <Progress value={(stat.average / 10) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}