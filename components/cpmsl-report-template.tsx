// components/school/cpmsl-report-template.tsx
"use client"

import React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export interface SubjectGrade {
  id: string
  name: string
  score: number | null
  coefficient: number
  maxScore: number
  normalizedScore: number | null
  comment?: string
  isSection?: boolean
  parentId?: string
  sections?: SubjectGrade[]
}

export interface RubriqueData {
  name: string
  weight: number
  subjects: SubjectGrade[]
  average: number | null
  classAverage: number
}

export interface CPMSLReportTemplateProps {
  student: {
    id: string
    firstName: string
    lastName: string
    nisu: string
    matricule: string
    dateOfBirth?: string
    avatar?: string
  }
  level: {
    id: string
    name: string
    filiere?: string
  }
  period: {
    id: string
    name: string
    isBlancExam: boolean
  }
  academicYear: string
  className: string
  rubriques: RubriqueData[]
  finalAverage: number | null
  classFinalAverage: number
  behavior?: {
    absences?: number
    retards?: number
    devoirsManques?: number
    pointsForts?: string
    defis?: string
    remarque?: string
    attitudeResponses?: Array<{ attitudeId: string; value: boolean }>
  }
  attitudes: Array<{
    id: string
    label: string
  }>
}

export function CPMSLReportTemplate({
  student,
  level,
  period,
  academicYear,
  className,
  rubriques,
  finalAverage,
  classFinalAverage,
  behavior,
  attitudes
}: CPMSLReportTemplateProps) {
  
  const getAppreciation = (avg: number | null) => {
    if (avg === null) return { text: 'Non évalué', class: 'text-gray-500' }
    if (avg >= 9.0) return { text: 'A+ Excellent', class: 'text-green-700' }
    if (avg >= 8.5) return { text: 'A Excellent', class: 'text-green-600' }
    if (avg >= 7.8) return { text: 'B+ Très bien', class: 'text-blue-600' }
    if (avg >= 7.5) return { text: 'B Très bien', class: 'text-blue-500' }
    if (avg >= 6.9) return { text: 'C+ Bien', class: 'text-yellow-600' }
    if (avg >= 6.0) return { text: 'C Assez bien', class: 'text-yellow-500' }
    if (avg >= 5.1) return { text: 'D Déficient', class: 'text-orange-500' }
    return { text: 'E Échec', class: 'text-red-600' }
  }

  const appreciation = getAppreciation(finalAverage)
  const isPassing = finalAverage !== null && finalAverage >= 7

  const formatDate = (date: any) => {
    if (!date) return '—'
    if (typeof date === 'object') {
      if (date.date) return new Date(date.date).toLocaleDateString('fr-FR')
      if (date.toString && date.toString() !== '[object Object]') return date.toString()
      return '—'
    }
    if (typeof date === 'string') return new Date(date).toLocaleDateString('fr-FR')
    return '—'
  }

  return (
    <div className="bg-white text-black w-full h-full p-8 font-sans text-sm">
      {/* EN-TÊTE */}
      <div className="grid grid-cols-[120px_1fr_120px] gap-4 mb-6 pb-4 border-b-2 border-gray-800">
        <div className="flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-1">
            <span className="text-2xl font-bold text-gray-600">C</span>
          </div>
          <div className="text-[10px] font-semibold text-center">Depuis 1998</div>
        </div>

        <div className="space-y-3">
          <h1 className="text-center text-xl font-bold mb-3">Bulletin Scolaire</h1>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex"><span className="font-semibold w-20">Prénom(s):</span><span>{student.firstName || '—'}</span></div>
            <div className="flex"><span className="font-semibold w-16">Nom:</span><span>{student.lastName || '—'}</span></div>
            <div className="flex"><span className="font-semibold w-20">Niveau:</span><span>{level.name || '—'}</span></div>
            <div className="flex"><span className="font-semibold w-16">Filière:</span><span>{level.filiere || '—'}</span></div>
            <div className="flex"><span className="font-semibold w-20">Période:</span><span>{period.name || '—'}</span></div>
            <div className="flex"><span className="font-semibold w-16">Étape:</span><span>{period.name || '—'}</span></div>
            <div className="flex"><span className="font-semibold w-20">Date naissance:</span><span>{formatDate(student.dateOfBirth)}</span></div>
            <div className="flex"><span className="font-semibold w-16">Année:</span><span>{academicYear || '—'}</span></div>
            <div className="flex"><span className="font-semibold w-20">Code élève:</span><span>{student.matricule || '—'}</span></div>
            <div className="flex"><span className="font-semibold w-16">NISU:</span><span>{student.nisu || '—'}</span></div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <Avatar className="w-24 h-24 border-2 border-gray-300">
            <AvatarImage src={student.avatar} />
            <AvatarFallback className="text-2xl bg-gray-100">
              {student.firstName?.[0]}{student.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* CORPS - 3 COLONNES RUBRIQUES */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {rubriques.map((rubrique, rubriqueIdx) => (
          <div key={rubriqueIdx} className="border border-gray-800">
            <div className="bg-gray-200 text-center font-bold py-1 border-b border-gray-800">
              {rubrique.name} ({rubrique.weight}%)
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-1 py-0.5 font-semibold">Matière</th>
                  <th className="text-center px-1 py-0.5 font-semibold w-12">Note</th>
                  <th className="text-center px-1 py-0.5 font-semibold w-10">Coeff</th>
                 </tr>
              </thead>
              <tbody>
                {rubrique.subjects.length === 0 ? (
                  <tr key="empty">
                    <td colSpan={3} className="text-center py-2 text-gray-400">Aucune matière</td>
                  </tr>
                ) : (
                  rubrique.subjects.map((subject, subjectIdx) => {
                    const parentGrade = subject.normalizedScore !== null 
                      ? subject.normalizedScore.toFixed(2) 
                      : '—'
                    
                    return (
                      <React.Fragment key={subject.id || subjectIdx}>
                        <tr className="border-b border-gray-300 bg-gray-50">
                          <td className="px-1 py-0.5 font-bold">{subject.name}</td>
                          <td className="text-center px-1 py-0.5 font-bold">{parentGrade}</td>
                          <td className="text-center px-1 py-0.5 font-bold">{subject.coefficient}</td>
                        </tr>
                        
                        {subject.sections && subject.sections.map((section, sectionIdx) => {
                          const sectionGrade = section.normalizedScore !== null 
                            ? section.normalizedScore.toFixed(2) 
                            : '—'
                          return (
                            <tr key={section.id || `${subject.id}-section-${sectionIdx}`} 
                                className={sectionIdx < (subject.sections?.length || 0) - 1 ? 'border-b border-gray-200' : ''}>
                              <td className="px-1 py-0.5 pl-4 text-gray-600">↳ {section.name}</td>
                              <td className="text-center px-1 py-0.5 text-gray-600">{sectionGrade}</td>
                              <td className="text-center px-1 py-0.5 text-gray-600">{section.coefficient}</td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
            <div className="border-t-2 border-gray-800 bg-gray-100 px-1 py-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Moyenne sur 10:</span>
                <span>{rubrique.average !== null ? rubrique.average.toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Moy. classe:</span>
                <span>{rubrique.classAverage.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SYNTHÈSE */}
      <div className="border-2 border-gray-800 bg-gray-100 p-2 mb-4">
        <div className="grid grid-cols-3 gap-4 text-sm font-semibold">
          <div className="flex justify-between">
            <span>Moy. de l'Étape:</span>
            <span className={`text-base ${isPassing ? 'text-green-600' : 'text-red-600'}`}>
              {finalAverage !== null ? finalAverage.toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Appréciation:</span>
            <span className={appreciation.class}>{appreciation.text}</span>
          </div>
          <div className="flex justify-between">
            <span>Moyenne classe:</span>
            <span>{classFinalAverage.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* SECTION COMPORTEMENT */}
      <div className="border border-gray-800 mb-4">
        <div className="bg-gray-200 text-center font-bold py-1 border-b border-gray-800">
          Comportement et Assiduité
        </div>
        <div className="p-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mb-2">
            {attitudes && attitudes.length > 0 ? (
              attitudes.map(attitude => {
                const response = behavior?.attitudeResponses?.find(r => r.attitudeId === attitude.id)
                const isYes = response?.value === true
                const isNo = response?.value === false
                return (
                  <div key={attitude.id} className="flex items-center gap-2">
                    <span className="flex-1">{attitude.label}</span>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-0.5">
                        <input type="checkbox" className="w-3 h-3" checked={isYes} readOnly />
                        <span className="text-xs">Oui</span>
                      </label>
                      <label className="flex items-center gap-0.5">
                        <input type="checkbox" className="w-3 h-3" checked={isNo} readOnly />
                        <span className="text-xs">Non</span>
                      </label>
                    </div>
                  </div>
                )
              })
            ) : (
              <div key="no-attitudes" className="col-span-2 text-center text-gray-400 text-xs">Aucune attitude enregistrée</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs mb-2 border-t border-gray-300 pt-2">
            <div className="flex justify-between"><span>Absences:</span><span className="font-semibold">{behavior?.absences ?? '—'}</span></div>
            <div className="flex justify-between"><span>Retards:</span><span className="font-semibold">{behavior?.retards ?? '—'}</span></div>
            <div className="flex justify-between"><span>Devoirs manqués:</span><span className="font-semibold">{behavior?.devoirsManques ?? '—'}</span></div>
          </div>

          <div className="space-y-1 text-xs">
            <div><span className="font-semibold">Points forts:</span><div className="border-b border-gray-400 min-h-[20px] px-1">{behavior?.pointsForts || ''}</div></div>
            <div><span className="font-semibold">Défis à relever:</span><div className="border-b border-gray-400 min-h-[20px] px-1">{behavior?.defis || ''}</div></div>
            <div><span className="font-semibold">Remarque:</span><div className="border-b border-gray-400 min-h-[20px] px-1">{behavior?.remarque || ''}</div></div>
          </div>
        </div>
      </div>

      {/* PIED DE PAGE */}
      <div className="space-y-2">
        <div className="border border-gray-800 p-1">
          <div className="text-[9px] font-semibold mb-1">Légende des notes:</div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-[8px]">
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
        <div className="text-[9px] space-y-0.5">
          <div className="font-semibold">Seuil de réussite pour promotion automatique en classe supérieure : 7.00</div>
          <div>Calcul de la moyenne de l'étape : 70%(R1) + 25%(R2) + 5%(R3)</div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-gray-800">
          <div><div className="font-semibold mb-1">Signature Parent:</div><div className="border-b border-gray-400 h-8"></div></div>
          <div><div className="font-semibold mb-1">Signature Direction:</div><div className="border-b border-gray-400 h-8"></div></div>
        </div>
      </div>
    </div>
  )
}