import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { type Student, type SubjectParent, type SubjectChild, type Grade, type Period, type Level, type StudentBehavior, type Attitude } from "@/lib/data/school-data"

interface CPMSLReportTemplateProps {
  student: Student
  level: Level
  period: Period
  subjectParents: SubjectParent[]
  subjectChildren: SubjectChild[]
  grades: Grade[]
  behavior?: StudentBehavior
  attitudes: Attitude[]
  academicYear: string
  className?: string
}

export function CPMSLReportTemplate({
  student,
  level,
  period,
  subjectParents,
  subjectChildren,
  grades,
  behavior,
  attitudes,
  academicYear,
  className = ""
}: CPMSLReportTemplateProps) {
  // Determine if this is blanc exam mode
  const isBlancExam = period.isBlancExam || false

  // Get coefficient for a parent subject based on level's filiere
  const getParentCoefficient = (parent: SubjectParent) => {
    const filiere = level.filiere || null
    const coeff = parent.coefficients.find(c => c.filiereId === filiere)
    return coeff?.valeur || 1
  }

  // Calculate grades by rubrique
  // In blanc exam mode: use parent subjects
  // In normal mode: use child subjects
  const subjectsByRubrique = isBlancExam ? {
    R1: subjectParents.filter(sp => sp.rubrique === 'R1' && sp.levelIds.includes(level.id)),
    R2: subjectParents.filter(sp => sp.rubrique === 'R2' && sp.levelIds.includes(level.id)),
    R3: subjectParents.filter(sp => sp.rubrique === 'R3' && sp.levelIds.includes(level.id)),
  } : {
    R1: subjectChildren.filter(sc => {
      const parent = subjectParents.find(sp => sp.id === sc.parentId)
      return parent?.rubrique === 'R1' && parent?.levelIds.includes(level.id)
    }),
    R2: subjectChildren.filter(sc => {
      const parent = subjectParents.find(sp => sp.id === sc.parentId)
      return parent?.rubrique === 'R2' && parent?.levelIds.includes(level.id)
    }),
    R3: subjectChildren.filter(sc => {
      const parent = subjectParents.find(sp => sp.id === sc.parentId)
      return parent?.rubrique === 'R3' && parent?.levelIds.includes(level.id)
    }),
  }

  const getGradeForSubject = (subjectId: string) => {
    const grade = grades.find(g => g.subjectId === subjectId && g.studentId === student.id)
    return grade?.value
  }

  const calculateRubriqueAverage = (rubrique: 'R1' | 'R2' | 'R3') => {
    const rubriqueSubjects = subjectsByRubrique[rubrique]
    if (rubriqueSubjects.length === 0) return 0

    let totalWeighted = 0
    let totalCoeff = 0

    rubriqueSubjects.forEach(subject => {
      const grade = getGradeForSubject(subject.id)
      if (grade !== undefined) {
        const coefficient = isBlancExam 
          ? getParentCoefficient(subject as SubjectParent)
          : (subject as SubjectChild).coefficient
        totalWeighted += grade * coefficient
        totalCoeff += coefficient
      }
    })

    return totalCoeff > 0 ? totalWeighted / totalCoeff : 0
  }

  const r1Average = calculateRubriqueAverage('R1')
  const r2Average = calculateRubriqueAverage('R2')
  const r3Average = calculateRubriqueAverage('R3')

  // Calculate final average: 70% R1 + 25% R2 + 5% R3
  const finalAverage = (r1Average * 0.7 + r2Average * 0.25 + r3Average * 0.05)

  // Mock class averages
  const classR1Average = 7.2
  const classR2Average = 7.5
  const classR3Average = 8.1
  const classFinalAverage = 7.3

  // Get appreciation
  const getAppreciation = (avg: number) => {
    if (avg >= 9.0) return 'A+ Excellent'
    if (avg >= 8.5) return 'A Excellent'
    if (avg >= 7.8) return 'B+ Très bien'
    if (avg >= 7.5) return 'B Très bien'
    if (avg >= 6.9) return 'C+ Bien'
    if (avg >= 6.0) return 'C Assez bien'
    if (avg >= 5.1) return 'D Déficient'
    return 'E Échec'
  }

  // Extract filiere from level name
  const getFiliere = () => {
    if (level.name.includes('LLA')) return 'LLA'
    if (level.name.includes('SES')) return 'SES'
    if (level.name.includes('SMP')) return 'SMP'
    if (level.name.includes('SVT')) return 'SVT'
    return '—'
  }

  return (
    <div className={`bg-white text-black w-full h-full p-8 text-[10px] ${className}`}>
      {/* EN-TÊTE */}
      <div className="grid grid-cols-[1fr_2fr_1fr] gap-4 mb-6 pb-4 border-b-2 border-black">
        {/* Gauche: Logo */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-1">
            <span className="text-2xl font-bold text-gray-600">C</span>
          </div>
          <div className="text-[8px] font-semibold text-center">Depuis 1998</div>
        </div>

        {/* Centre: Titre + Identité */}
        <div className="space-y-3">
          <h1 className="text-center text-lg font-bold mb-3">Bulletin Scolaire</h1>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
            <div className="flex">
              <span className="font-semibold w-24">Prénom(s):</span>
              <span>{student.firstName}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-20">Nom:</span>
              <span>{student.lastName}</span>
            </div>
            
            <div className="flex">
              <span className="font-semibold w-24">Niveau:</span>
              <span>{level.name}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-20">Filière:</span>
              <span>{getFiliere()}</span>
            </div>
            
            <div className="flex">
              <span className="font-semibold w-24">Période:</span>
              <span>{period.name}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-20">Étape:</span>
              <span>1ère Étape</span>
            </div>
            
            <div className="flex">
              <span className="font-semibold w-24">Date naissance:</span>
              <span>{student.dateOfBirth || '—'}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-20">Année:</span>
              <span>{academicYear}</span>
            </div>
            
            <div className="flex">
              <span className="font-semibold w-24">Code élève:</span>
              <span>{student.matricule}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-20">NISU:</span>
              <span>{student.nisu || '—'}</span>
            </div>
          </div>
        </div>

        {/* Droite: Photo */}
        <div className="flex items-center justify-center">
          <Avatar className="w-24 h-24 border-2 border-gray-300">
            <AvatarImage src={student.avatar} />
            <AvatarFallback className="text-2xl bg-gray-100">
              {student.firstName[0]}{student.lastName[0]}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* CORPS - 3 COLONNES RUBRIQUES */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Rubrique 1 */}
        <div className="border border-black">
          <div className="bg-gray-200 text-center font-bold py-1 border-b border-black">
            Rubrique 1 (70%)
          </div>
          <table className="w-full text-[8px]">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left px-1 py-0.5 font-semibold">Matière</th>
                <th className="text-center px-1 py-0.5 font-semibold w-12">Note</th>
                <th className="text-center px-1 py-0.5 font-semibold w-10">Coeff</th>
              </tr>
            </thead>
            <tbody>
              {subjectsByRubrique.R1.map((subject, idx) => {
                const grade = getGradeForSubject(subject.id)
                const coefficient = isBlancExam 
                  ? getParentCoefficient(subject as SubjectParent)
                  : (subject as SubjectChild).coefficient
                return (
                  <tr key={subject.id} className={idx < subjectsByRubrique.R1.length - 1 ? 'border-b border-gray-300' : ''}>
                    <td className="px-1 py-0.5">{subject.name}</td>
                    <td className="text-center px-1 py-0.5">{grade !== undefined ? grade.toFixed(1) : '—'}</td>
                    <td className="text-center px-1 py-0.5">{coefficient}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="border-t-2 border-black bg-gray-100 px-1 py-1">
            <div className="flex justify-between text-[8px] font-semibold">
              <span>Moyenne sur 10:</span>
              <span>{r1Average.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[8px] text-gray-600">
              <span>Moy. classe:</span>
              <span>{classR1Average.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Rubrique 2 */}
        <div className="border border-black">
          <div className="bg-gray-200 text-center font-bold py-1 border-b border-black">
            Rubrique 2 (25%)
          </div>
          <table className="w-full text-[8px]">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left px-1 py-0.5 font-semibold">Matière</th>
                <th className="text-center px-1 py-0.5 font-semibold w-12">Note</th>
                <th className="text-center px-1 py-0.5 font-semibold w-10">Coeff</th>
              </tr>
            </thead>
            <tbody>
              {subjectsByRubrique.R2.map((subject, idx) => {
                const grade = getGradeForSubject(subject.id)
                const coefficient = isBlancExam 
                  ? getParentCoefficient(subject as SubjectParent)
                  : (subject as SubjectChild).coefficient
                return (
                  <tr key={subject.id} className={idx < subjectsByRubrique.R2.length - 1 ? 'border-b border-gray-300' : ''}>
                    <td className="px-1 py-0.5">{subject.name}</td>
                    <td className="text-center px-1 py-0.5">{grade !== undefined ? grade.toFixed(1) : '—'}</td>
                    <td className="text-center px-1 py-0.5">{coefficient}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="border-t-2 border-black bg-gray-100 px-1 py-1">
            <div className="flex justify-between text-[8px] font-semibold">
              <span>Moyenne sur 10:</span>
              <span>{r2Average.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[8px] text-gray-600">
              <span>Moy. classe:</span>
              <span>{classR2Average.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Rubrique 3 */}
        <div className="border border-black">
          <div className="bg-gray-200 text-center font-bold py-1 border-b border-black">
            Rubrique 3 (5%)
          </div>
          <table className="w-full text-[8px]">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left px-1 py-0.5 font-semibold">Matière</th>
                <th className="text-center px-1 py-0.5 font-semibold w-12">Note</th>
                <th className="text-center px-1 py-0.5 font-semibold w-10">Coeff</th>
              </tr>
            </thead>
            <tbody>
              {subjectsByRubrique.R3.map((subject, idx) => {
                const grade = getGradeForSubject(subject.id)
                const coefficient = isBlancExam 
                  ? getParentCoefficient(subject as SubjectParent)
                  : (subject as SubjectChild).coefficient
                return (
                  <tr key={subject.id} className={idx < subjectsByRubrique.R3.length - 1 ? 'border-b border-gray-300' : ''}>
                    <td className="px-1 py-0.5">{subject.name}</td>
                    <td className="text-center px-1 py-0.5">{grade !== undefined ? grade.toFixed(1) : '—'}</td>
                    <td className="text-center px-1 py-0.5">{coefficient}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="border-t-2 border-black bg-gray-100 px-1 py-1">
            <div className="flex justify-between text-[8px] font-semibold">
              <span>Moyenne sur 10:</span>
              <span>{r3Average.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[8px] text-gray-600">
              <span>Moy. classe:</span>
              <span>{classR3Average.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SYNTHÈSE */}
      <div className="border-2 border-black bg-gray-100 p-2 mb-4">
        <div className="grid grid-cols-3 gap-4 text-[9px] font-semibold">
          <div className="flex justify-between">
            <span>Moy. de l'Étape:</span>
            <span className="text-base">{finalAverage.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Appréciation:</span>
            <span>{getAppreciation(finalAverage)}</span>
          </div>
          <div className="flex justify-between">
            <span>Moyenne classe:</span>
            <span>{classFinalAverage.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* SECTION COMPORTEMENT */}
      <div className="border border-black mb-4">
        <div className="bg-gray-200 text-center font-bold py-1 border-b border-black">
          Comportement et Assiduité
        </div>
        <div className="p-2">
          {/* Grille Oui/Non - Dynamic from attitudes */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8px] mb-2">
            {attitudes?.map(attitude => {
              const response = behavior?.attitudeResponses?.find(r => r.attitudeId === attitude.id)
              const isYes = response?.value === true
              const isNo = response?.value === false
              
              return (
                <div key={attitude.id} className="flex items-center gap-2">
                  <span className="flex-1">{attitude.label}</span>
                  <div className="flex gap-1">
                    <label className="flex items-center gap-0.5">
                      <input type="checkbox" className="w-3 h-3" checked={isYes} readOnly />
                      <span>Oui</span>
                    </label>
                    <label className="flex items-center gap-0.5">
                      <input type="checkbox" className="w-3 h-3" checked={isNo} readOnly />
                      <span>Non</span>
                    </label>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8px] mb-2 border-t border-gray-300 pt-2">
            <div className="flex justify-between">
              <span>Absences:</span>
              <span className="font-semibold">{behavior?.absences ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Devoirs manqués:</span>
              <span className="font-semibold">{behavior?.devoirsManques ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Retards:</span>
              <span className="font-semibold">{behavior?.retards ?? '—'}</span>
            </div>

          </div>

          {/* Commentaires */}
          <div className="space-y-1 text-[8px]">
            <div>
              <span className="font-semibold">Points forts:</span>
              <div className="border-b border-gray-400 min-h-[16px] px-1">
                {behavior?.pointsForts || ''}
              </div>
            </div>
            <div>
              <span className="font-semibold">Défis à relever:</span>
              <div className="border-b border-gray-400 min-h-[16px] px-1">
                {behavior?.defis || ''}
              </div>
            </div>
            <div>
              <span className="font-semibold">Remarque:</span>
              <div className="border-b border-gray-400 min-h-[16px] px-1">
                {behavior?.remarque || ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PIED DE PAGE */}
      <div className="space-y-2">
        {/* Légende des notes */}
        <div className="border border-black p-1">
          <div className="text-[7px] font-semibold mb-1">Légende des notes:</div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-[6px]">
            <div>90-100 <span className="font-semibold">A+</span> Excellent</div>
            <div>78-84 <span className="font-semibold">B+</span> Très bien</div>
            <div>69-74 <span className="font-semibold">C+</span> Bien</div>
            <div>51-59 <span className="font-semibold">D</span> Déficient</div>
            <div>85-89 <span className="font-semibold">A</span> Excellent</div>
            <div>75-77 <span className="font-semibold">B</span> Très bien</div>
            <div>60-68 <span className="font-semibold">C</span> Assez bien</div>
            <div>0-50 <span className="font-semibold">E</span> Échec</div>
          </div>
        </div>

        {/* Informations */}
        <div className="text-[7px] space-y-0.5">
          <div className="font-semibold">
            Seuil de réussite pour promotion automatique en classe supérieure : 7.00
          </div>
          <div>
            Calcul de la moyenne de l'étape : 70%(R1) + 25%(R2) + 5%(R3)
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-4 text-[8px] pt-2 border-t border-black">
          <div>
            <div className="font-semibold mb-1">Signature Parent:</div>
            <div className="border-b border-gray-400 h-8"></div>
          </div>
          <div>
            <div className="font-semibold mb-1">Signature Direction:</div>
            <div className="border-b border-gray-400 h-8"></div>
          </div>
        </div>
      </div>
    </div>
  )
}