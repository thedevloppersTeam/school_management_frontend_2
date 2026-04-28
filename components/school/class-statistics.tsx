import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRightIcon } from "lucide-react";

interface ClassStatistic {
  className: string;
  studentCount: number;
  gradesEntered: number;
  totalGrades: number;
  averageGrade?: number;
  status: "complete" | "in-progress" | "not-started";
}

interface ClassStatisticsProps {
  classes: ClassStatistic[];
  periodName?: string;
  academicYear?: string;
  onViewAll?: () => void;
}

export function ClassStatistics({
  classes,
  periodName = "Étape 2",
  academicYear = "2024-2025",
  onViewAll,
}: ClassStatisticsProps) {
  const getStatusBadge = (status: ClassStatistic["status"]) => {
    switch (status) {
      case "complete":
        return (
          <Badge className="font-medium border-0 bg-success-soft text-success">
            Complet
          </Badge>
        );
      case "in-progress":
        return (
          <Badge className="font-medium border-0 bg-warning-soft text-warning">
            En cours
          </Badge>
        );
      case "not-started":
        return (
          <Badge className="font-medium border-0 bg-error-soft text-error">
            Non commencé
          </Badge>
        );
    }
  };

  const getProgressPercentage = (entered: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((entered / total) * 100);
  };

  return (
    <Card className="border border-neutral-200 rounded-lg shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="heading-3 text-primary-600">
          Classes — Année {academicYear}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-neutral-100">
                <th className="text-left py-3 px-4 text-[13px] font-semibold uppercase tracking-wider text-primary-600">
                  Classe
                </th>
                <th className="text-left py-3 px-4 text-[13px] font-semibold uppercase tracking-wider text-primary-600">
                  Effectif
                </th>
                <th className="text-left py-3 px-4 text-[13px] font-semibold uppercase tracking-wider text-primary-600">
                  Notes saisies
                </th>
                <th className="text-left py-3 px-4 text-[13px] font-semibold uppercase tracking-wider text-primary-600">
                  Moy. générale
                </th>
                <th className="text-left py-3 px-4 text-[13px] font-semibold uppercase tracking-wider text-primary-600">
                  Statut {periodName}
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.map((classData, index) => (
                <tr
                  key={index}
                  className={`border-b border-neutral-200 hover:bg-secondary-50 transition-colors cursor-pointer ${
                    index % 2 === 0 ? "bg-neutral-50" : "bg-white"
                  }`}
                >
                  <td className="py-3 px-4 text-sm text-neutral-900">
                    {classData.className}
                  </td>
                  <td className="py-3 px-4 text-sm text-neutral-600">
                    {classData.studentCount}
                  </td>
                  <td className="py-3 px-4 text-sm text-neutral-600">
                    {classData.gradesEntered}/{classData.totalGrades} (
                    {getProgressPercentage(
                      classData.gradesEntered,
                      classData.totalGrades,
                    )}
                    %)
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-neutral-900">
                    {classData.averageGrade
                      ? classData.averageGrade.toFixed(2)
                      : "—"}
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
              className="p-0 h-auto body-base font-medium text-primary-500"
            >
              Voir toutes les classes
              <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
