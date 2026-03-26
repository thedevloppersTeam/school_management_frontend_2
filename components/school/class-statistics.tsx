import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRightIcon } from "lucide-react"

interface ClassStatistic {
  className: string
  studentCount: number
  gradesEntered: number
  totalGrades: number
  averageGrade?: number
  status: 'complete' | 'in-progress' | 'not-started'
}

interface ClassStatisticsProps {
  classes: ClassStatistic[]
  periodName?: string
  academicYear?: string
  onViewAll?: () => void
}

export function ClassStatistics({ classes, periodName = "Étape 2", academicYear = "2024-2025", onViewAll }: ClassStatisticsProps) {
  const getStatusBadge = (status: ClassStatistic['status']) => {
    switch (status) {
      case 'complete':
        return (
          <Badge 
            className="font-medium border-0"
            style={{ 
              backgroundColor: "#E8F5EC", 
              color: "#2D7D46" 
            }}
          >
            Complet
          </Badge>
        )
      case 'in-progress':
        return (
          <Badge 
            className="font-medium border-0"
            style={{ 
              backgroundColor: "#FEF6E0", 
              color: "#C48B1A" 
            }}
          >
            En cours
          </Badge>
        )
      case 'not-started':
        return (
          <Badge 
            className="font-medium border-0"
            style={{ 
              backgroundColor: "#FDE8E8", 
              color: "#C43C3C" 
            }}
          >
            Non commencé
          </Badge>
        )
    }
  }

  const getProgressPercentage = (entered: number, total: number) => {
    if (total === 0) return 0
    return Math.round((entered / total) * 100)
  }

  return (
    <Card 
      className="border border-[#E8E6E3] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      style={{ backgroundColor: "white" }}
    >
      <CardHeader>
        <CardTitle 
          className="font-serif"
          style={{ 
            fontSize: "20px",
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: "-0.02em",
            color: "#3A4A57" 
          }}
        >
          Classes — Année {academicYear}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr style={{ backgroundColor: "#F0F4F7" }}>
                <th 
                  className="text-left py-3 px-4 font-sans uppercase"
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.4,
                    letterSpacing: "0.04em",
                    color: "#4A5D6E" 
                  }}
                >
                  Classe
                </th>
                <th 
                  className="text-left py-3 px-4 font-sans uppercase"
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.4,
                    letterSpacing: "0.04em",
                    color: "#4A5D6E" 
                  }}
                >
                  Effectif
                </th>
                <th 
                  className="text-left py-3 px-4 font-sans uppercase"
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.4,
                    letterSpacing: "0.04em",
                    color: "#4A5D6E" 
                  }}
                >
                  Notes saisies
                </th>
                <th 
                  className="text-left py-3 px-4 font-sans uppercase"
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.4,
                    letterSpacing: "0.04em",
                    color: "#4A5D6E" 
                  }}
                >
                  Moy. générale
                </th>
                <th 
                  className="text-left py-3 px-4 font-sans uppercase"
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.4,
                    letterSpacing: "0.04em",
                    color: "#4A5D6E" 
                  }}
                >
                  Statut {periodName}
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.map((classData, index) => (
                <tr
                  key={index}
                  className="border-b border-[#E8E6E3] hover:bg-[#FAF8F3] transition-colors cursor-pointer"
                  style={{ 
                    backgroundColor: index % 2 === 0 ? "#FAFAF8" : "white" 
                  }}
                >
                  <td 
                    className="py-3 px-4 font-sans font-medium"
                    style={{ 
                      fontSize: "14px",
                      fontWeight: 400,
                      lineHeight: 1.5,
                      color: "#1E1A17" 
                    }}
                  >
                    {classData.className}
                  </td>
                  <td 
                    className="py-3 px-4 font-sans"
                    style={{ 
                      fontSize: "14px",
                      fontWeight: 400,
                      lineHeight: 1.5,
                      color: "#5C5955" 
                    }}
                  >
                    {classData.studentCount}
                  </td>
                  <td 
                    className="py-3 px-4 font-sans"
                    style={{ 
                      fontSize: "14px",
                      fontWeight: 400,
                      lineHeight: 1.5,
                      color: "#5C5955" 
                    }}
                  >
                    {classData.gradesEntered}/{classData.totalGrades} ({getProgressPercentage(classData.gradesEntered, classData.totalGrades)}%)
                  </td>
                  <td 
                    className="py-3 px-4 font-sans font-medium"
                    style={{ 
                      fontSize: "14px",
                      fontWeight: 400,
                      lineHeight: 1.5,
                      color: "#1E1A17" 
                    }}
                  >
                    {classData.averageGrade ? classData.averageGrade.toFixed(2) : "—"}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(classData.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {onViewAll && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="link"
              onClick={onViewAll}
              className="p-0 h-auto body-base font-medium"
              style={{ color: "#5A7085" }}
            >
              Voir toutes les classes
              <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}