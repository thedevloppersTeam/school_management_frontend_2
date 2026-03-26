"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, LabelList } from "recharts"
import { PlusIcon, SearchIcon, AlertTriangleIcon, UserIcon, ArrowUpIcon, ArrowDownIcon, CheckCircleIcon, UsersIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { students, levels, academicYears, classrooms, type Student } from "@/lib/data/school-data"
import { ArchivedYearBanner } from "@/components/school/archived-year-banner"
import { StudentFormDialog, type StudentFormData } from "@/components/school/student-form-dialog"
import { cn } from "@/lib/utils"

// CPMSL Color Palette
const COLORS = {
  primary: {
    50: '#F0F4F7',
    100: '#D9E3EA',
    200: '#B3C7D5',
    500: '#5A7085',
    600: '#4A5D6E',
    700: '#3A4A57',
    800: '#2A3740',
  },
  secondary: {
    50: '#FAF8F3',
    100: '#F0EBDF',
    400: '#C3B594',
    700: '#7A6E50',
  },
  neutral: {
    50: '#FAFAF8',
    100: '#F5F4F2',
    200: '#E8E6E3',
    300: '#D1CECC',
    400: '#A8A5A2',
    500: '#78756F',
    600: '#5C5955',
    700: '#3D3A36',
    900: '#1E1A17',
  },
  success: { main: '#2D7D46', light: '#E8F5EC' },
  warning: { main: '#C48B1A', light: '#FEF6E0' },
  error: { main: '#C43C3C', light: '#FDE8E8' },
  info: { main: '#2B6CB0', light: '#E3EFF9' },
}

export default function StudentsManagementPage() {
  const params = useParams()
  const yearId = (params.yearId as string) || 'ay-2024'
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLevel, setSelectedLevel] = useState<string>("all")
  const [selectedSubdivision, setSelectedSubdivision] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25
  const [filterInvalidNisu, setFilterInvalidNisu] = useState(false)
  const [filterNoPhoto, setFilterNoPhoto] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deactivatingStudent, setDeactivatingStudent] = useState<Student | null>(null)
  const [deactivationReason, setDeactivationReason] = useState("")
  const [inactiveStudentIds, setInactiveStudentIds] = useState<string[]>([])
  
  type SortColumn = 'nisu' | 'fullName' | 'gender' | 'classroom'
  type SortDirection = 'asc' | 'desc' | null
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const currentYear = academicYears.find(y => y.id === yearId)
  const isArchived = currentYear?.status === 'archived'

  const yearStudents = students.filter(s => {
    const isInactive = inactiveStudentIds.includes(s.id)
    if (showInactive) return s.academicYearId === yearId
    return s.academicYearId === yearId && !isInactive
  })

  // KPIs
  const totalStudents = yearStudents.length
  const femaleStudents = yearStudents.filter(s => s.gender === 'F').length
  const maleStudents = yearStudents.filter(s => s.gender === 'M').length
  const studentsWithoutPhoto = yearStudents.filter(s => !s.avatar).length
  const studentsWithInvalidNisu = yearStudents.filter(s => !s.nisu || !/^\d{12}$/.test(s.nisu)).length
  const deactivatedStudents = inactiveStudentIds.length

  // Chart data
  const studentsPerLevel = useMemo(() => {
    const levelCounts = new Map<string, number>()
    yearStudents.forEach(student => {
      const count = levelCounts.get(student.levelId) || 0
      levelCounts.set(student.levelId, count + 1)
    })

    // Get all levels for the year and map to chart data
    const allLevels = levels
      .filter(l => l.academicYearId === yearId)
      .map(level => ({
        name: level.name,
        count: levelCounts.get(level.id) || 0
      }))

    // Sort by level order: 7e, 8e, 9e, NSI, NSII, NSIII, NSIV
    const levelOrder = ['7e', '8e', '9e', 'NSI', 'NSII', 'NSIII', 'NSIV']
    return allLevels.sort((a, b) => {
      const aBase = a.name.match(/^(\d+e|NSI+)/)?.[0] || a.name
      const bBase = b.name.match(/^(\d+e|NSI+)/)?.[0] || b.name
      const aIndex = levelOrder.indexOf(aBase)
      const bIndex = levelOrder.indexOf(bBase)
      if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name)
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  }, [yearStudents, yearId])

  // Filtering
  const getBaseLevel = (levelName: string): string => {
    const match = levelName.match(/^(\d+e|NSII|NSI)/)
    return match ? match[1] : levelName
  }

  const getSubdivision = (levelName: string): string => {
    const baseLevel = getBaseLevel(levelName)
    return levelName.replace(baseLevel, '').trim()
  }

  const uniqueBaseLevels = useMemo(() => {
    const baseLevels = new Set<string>()
    levels.filter(l => l.academicYearId === yearId).forEach(level => {
      baseLevels.add(getBaseLevel(level.name))
    })
    return Array.from(baseLevels).sort((a, b) => {
      const order = ['7e', '8e', '9e', 'NSI', 'NSII']
      return order.indexOf(a) - order.indexOf(b)
    })
  }, [yearId])

  const availableSubdivisions = useMemo(() => {
    if (selectedLevel === 'all') return []
    const subdivisions = new Set<string>()
    levels
      .filter(l => l.academicYearId === yearId && getBaseLevel(l.name) === selectedLevel)
      .forEach(level => {
        const subdivision = getSubdivision(level.name)
        if (subdivision) subdivisions.add(subdivision)
      })
    return Array.from(subdivisions).sort((a, b) => {
      const aIsLetter = /^[A-Z]$/.test(a)
      const bIsLetter = /^[A-Z]$/.test(b)
      if (aIsLetter && !bIsLetter) return -1
      if (!aIsLetter && bIsLetter) return 1
      return a.localeCompare(b)
    })
  }, [selectedLevel, yearId])

  const filteredStudents = useMemo(() => {
    let result = yearStudents

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(s => 
        s.firstName.toLowerCase().includes(query) ||
        s.lastName.toLowerCase().includes(query) ||
        s.nisu.includes(query)
      )
    }

    if (selectedLevel !== "all") {
      result = result.filter(s => {
        const level = levels.find(l => l.id === s.levelId)
        return level && getBaseLevel(level.name) === selectedLevel
      })
    }

    if (selectedSubdivision !== "all") {
      result = result.filter(s => {
        const level = levels.find(l => l.id === s.levelId)
        return level && getSubdivision(level.name) === selectedSubdivision
      })
    }

    if (filterInvalidNisu) {
      result = result.filter(s => !s.nisu || !/^\d{12}$/.test(s.nisu))
    }

    if (filterNoPhoto) {
      result = result.filter(s => !s.avatar)
    }

    if (sortColumn && sortDirection) {
      result = [...result].sort((a, b) => {
        let aValue: string | number = ''
        let bValue: string | number = ''

        switch (sortColumn) {
          case 'nisu':
            aValue = a.nisu
            bValue = b.nisu
            break
          case 'fullName':
            aValue = `${a.firstName} ${a.lastName}`.toLowerCase()
            bValue = `${b.firstName} ${b.lastName}`.toLowerCase()
            break
          case 'gender':
            aValue = a.gender
            bValue = b.gender
            break
          case 'classroom':
            const levelA = levels.find(l => l.id === a.levelId)
            const levelB = levels.find(l => l.id === b.levelId)
            aValue = levelA?.name.toLowerCase() || ''
            bValue = levelB?.name.toLowerCase() || ''
            break
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [yearStudents, searchQuery, selectedLevel, selectedSubdivision, filterInvalidNisu, filterNoPhoto, sortColumn, sortDirection])

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + itemsPerPage)

  useMemo(() => setCurrentPage(1), [searchQuery, selectedLevel, selectedSubdivision, filterInvalidNisu, filterNoPhoto])

  const getLevelName = (levelId: string) => {
    const level = levels.find(l => l.id === levelId)
    return level?.name || "N/A"
  }

  const getClassroomName = (classroomId: string) => {
    const classroom = classrooms.find(c => c.id === classroomId)
    return classroom?.name || "N/A"
  }

  const getClassAndSalle = (levelId: string, classroomId: string) => {
    const levelName = getLevelName(levelId)
    const salleName = getClassroomName(classroomId)
    return `${levelName} / ${salleName}`
  }

  const getStudentStatus = (student: Student): 'active' | 'incomplete' | 'deactivated' => {
    if (inactiveStudentIds.includes(student.id)) return 'deactivated'
    const hasInvalidNisu = !student.nisu || !/^\d{12}$/.test(student.nisu)
    const hasNoPhoto = !student.avatar
    if (hasInvalidNisu || hasNoPhoto) return 'incomplete'
    return 'active'
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') setSortDirection('desc')
      else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleStudentFormSubmit = (data: StudentFormData) => {
    toast({ 
      title: editingStudent ? "Élève modifié" : "Élève inscrit", 
      description: editingStudent ? `${data.firstName} ${data.lastName} a été mis à jour.` : `${data.firstName} ${data.lastName} a été inscrit avec succès.` 
    })
    setIsCreateModalOpen(false)
    setEditingStudent(null)
  }

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setIsCreateModalOpen(true)
  }

  const handleDeactivate = (student: Student) => {
    setDeactivatingStudent(student)
    setDeactivationReason("")
  }

  const confirmDeactivation = () => {
    if (deactivatingStudent) {
      setInactiveStudentIds([...inactiveStudentIds, deactivatingStudent.id])
      toast({ 
        title: "Élève désactivé", 
        description: `${deactivatingStudent.firstName} ${deactivatingStudent.lastName} a été désactivé.`, 
        variant: "destructive" 
      })
      setDeactivatingStudent(null)
    }
  }

  const handleReactivate = (studentId: string) => {
    setInactiveStudentIds(inactiveStudentIds.filter(id => id !== studentId))
    const student = students.find(s => s.id === studentId)
    toast({ 
      title: "Élève réactivé", 
      description: student ? `${student.firstName} ${student.lastName} a été réactivé.` : "L'élève a été réactivé." 
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 
          className="font-serif" 
          style={{ 
            fontSize: '36px',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            color: COLORS.primary[800], 
            marginBottom: '8px' 
          }}
        >
          Élèves
        </h1>
        <p 
          className="font-sans" 
          style={{ 
            fontSize: '13px',
            fontWeight: 400,
            color: COLORS.neutral[500] 
          }}
        >
          Année {currentYear?.name}
        </p>
      </div>

      {isArchived && currentYear && <ArchivedYearBanner yearName={currentYear.name} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card 
          style={{ 
            backgroundColor: 'white', 
            border: `1px solid ${COLORS.neutral[200]}`, 
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}
        >
          <CardHeader className="pb-3">
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: COLORS.neutral[500], 
                marginBottom: '4px' 
              }}
            >
              Total élèves
            </p>
            <p 
              className="font-serif" 
              style={{ 
                fontSize: '28px',
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.025em',
                color: COLORS.primary[800] 
              }}
            >
              {totalStudents}
            </p>
          </CardHeader>
        </Card>

        <Card 
          style={{ 
            backgroundColor: 'white', 
            border: `1px solid ${COLORS.neutral[200]}`, 
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}
        >
          <CardHeader className="pb-3">
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: COLORS.neutral[500], 
                marginBottom: '4px' 
              }}
            >
              Filles
            </p>
            <p 
              className="font-serif" 
              style={{ 
                fontSize: '28px',
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.025em',
                color: COLORS.primary[800] 
              }}
            >
              {femaleStudents}
            </p>
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 400,
                color: COLORS.neutral[500] 
              }}
            >
              {totalStudents > 0 ? Math.round((femaleStudents / totalStudents) * 100) : 0}%
            </p>
          </CardHeader>
        </Card>

        <Card 
          style={{ 
            backgroundColor: 'white', 
            border: `1px solid ${COLORS.neutral[200]}`, 
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}
        >
          <CardHeader className="pb-3">
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: COLORS.neutral[500], 
                marginBottom: '4px' 
              }}
            >
              Garçons
            </p>
            <p 
              className="font-serif" 
              style={{ 
                fontSize: '28px',
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.025em',
                color: COLORS.primary[800] 
              }}
            >
              {maleStudents}
            </p>
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 400,
                color: COLORS.neutral[500] 
              }}
            >
              {totalStudents > 0 ? Math.round((maleStudents / totalStudents) * 100) : 0}%
            </p>
          </CardHeader>
        </Card>

        <Card 
          onClick={() => {
            setFilterNoPhoto(!filterNoPhoto)
            if (!filterNoPhoto) setFilterInvalidNisu(false)
          }}
          style={{ 
            backgroundColor: 'white', 
            border: `1px solid ${COLORS.neutral[200]}`, 
            borderRadius: '10px',
            boxShadow: filterNoPhoto ? `0 0 0 2px ${COLORS.primary[500]}` : '0 2px 8px rgba(0,0,0,0.06)',
            cursor: 'pointer'
          }}
        >
          <CardHeader className="pb-3">
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: COLORS.neutral[500], 
                marginBottom: '4px' 
              }}
            >
              Sans photo
            </p>
            <p 
              className="font-serif" 
              style={{ 
                fontSize: '28px',
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.025em',
                color: COLORS.primary[800] 
              }}
            >
              {studentsWithoutPhoto}
            </p>
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 400,
                color: COLORS.neutral[500] 
              }}
            >
              {totalStudents > 0 ? Math.round((studentsWithoutPhoto / totalStudents) * 100) : 0}%
            </p>
          </CardHeader>
        </Card>

        <Card 
          onClick={() => {
            setFilterInvalidNisu(!filterInvalidNisu)
            if (!filterInvalidNisu) setFilterNoPhoto(false)
          }}
          style={{ 
            backgroundColor: 'white', 
            border: `1px solid ${COLORS.neutral[200]}`, 
            borderRadius: '10px',
            boxShadow: filterInvalidNisu ? `0 0 0 2px ${COLORS.primary[500]}` : '0 2px 8px rgba(0,0,0,0.06)',
            cursor: 'pointer'
          }}
        >
          <CardHeader className="pb-3">
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: COLORS.neutral[500], 
                marginBottom: '4px' 
              }}
            >
              Sans NISU valide
            </p>
            <p 
              className="font-serif" 
              style={{ 
                fontSize: '28px',
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.025em',
                color: COLORS.primary[800] 
              }}
            >
              {studentsWithInvalidNisu}
            </p>
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 400,
                color: COLORS.neutral[500] 
              }}
            >
              {totalStudents > 0 ? Math.round((studentsWithInvalidNisu / totalStudents) * 100) : 0}%
            </p>
          </CardHeader>
        </Card>

        <Card 
          style={{ 
            backgroundColor: 'white', 
            border: `1px solid ${COLORS.neutral[200]}`, 
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}
        >
          <CardHeader className="pb-3">
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: COLORS.neutral[500], 
                marginBottom: '4px' 
              }}
            >
              Désactivés
            </p>
            <p 
              className="font-serif" 
              style={{ 
                fontSize: '28px',
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.025em',
                color: COLORS.primary[800] 
              }}
            >
              {deactivatedStudents}
            </p>
            <p 
              className="font-sans" 
              style={{ 
                fontSize: '12px',
                fontWeight: 400,
                color: COLORS.neutral[500] 
              }}
            >
              {(totalStudents + deactivatedStudents) > 0 ? Math.round((deactivatedStudents / (totalStudents + deactivatedStudents)) * 100) : 0}%
            </p>
          </CardHeader>
        </Card>
      </div>

      {/* Chart */}
      {studentsPerLevel.length > 0 && (
        <Card style={{ backgroundColor: 'white', border: `1px solid ${COLORS.neutral[200]}`, borderRadius: '10px' }}>
          <CardHeader>
            <CardTitle 
              className="font-serif" 
              style={{ 
                fontSize: '20px',
                fontWeight: 600,
                lineHeight: 1.3,
                letterSpacing: '-0.02em',
                color: COLORS.primary[700] 
              }}
            >
              Répartition des élèves par classe
            </CardTitle>
            <CardDescription 
              className="font-sans" 
              style={{ 
                fontSize: '13px',
                fontWeight: 400,
                color: COLORS.neutral[500] 
              }}
            >
              Nombre d'élèves inscrits dans chaque classe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full aspect-[none]">
              <BarChart data={studentsPerLevel} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: COLORS.neutral[500], fontSize: 12 }}
                  angle={0}
                  textAnchor="middle"
                  height={40}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill={COLORS.primary[500]} radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="count"
                    position="top"
                    style={{ fill: COLORS.neutral[900], fontSize: 12, fontWeight: 500 }}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={setShowInactive}
            disabled={isArchived}
            style={{ 
              backgroundColor: showInactive ? COLORS.primary[500] : undefined 
            }}
          />
          <Label 
            htmlFor="show-inactive"
            className="body-base"
            style={{ color: COLORS.neutral[600], cursor: isArchived ? 'not-allowed' : 'pointer' }}
          >
            Afficher les élèves désactivés ({deactivatedStudents})
          </Label>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" 
              style={{ color: COLORS.neutral[400] }}
            />
            <Input
              type="text"
              placeholder="Rechercher par nom ou NISU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              style={{ 
                borderColor: COLORS.neutral[300],
                backgroundColor: 'white'
              }}
            />
          </div>

          <Select value={selectedLevel} onValueChange={(value) => {
            setSelectedLevel(value)
            setSelectedSubdivision('all')
          }}>
            <SelectTrigger className="w-full sm:w-[180px]" style={{ borderColor: COLORS.neutral[300] }}>
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {uniqueBaseLevels.map(baseLevel => (
                <SelectItem key={baseLevel} value={baseLevel}>{baseLevel}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select 
                    value={selectedSubdivision} 
                    onValueChange={setSelectedSubdivision}
                    disabled={selectedLevel === 'all' || availableSubdivisions.length === 0}
                  >
                    <SelectTrigger 
                      className="w-full sm:w-[180px]" 
                      style={{ 
                        borderColor: COLORS.neutral[300],
                        opacity: selectedLevel === 'all' || availableSubdivisions.length === 0 ? 0.5 : 1,
                        cursor: selectedLevel === 'all' || availableSubdivisions.length === 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <SelectValue placeholder="Toutes les salles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les salles</SelectItem>
                      {availableSubdivisions.map(subdivision => (
                        <SelectItem key={subdivision} value={subdivision}>{subdivision}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              {(selectedLevel === 'all' || availableSubdivisions.length === 0) && (
                <TooltipContent>
                  <p>Sélectionnez d'abord une classe</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {!isArchived && (
            <StudentFormDialog
              open={isCreateModalOpen}
              onOpenChange={(open) => {
                setIsCreateModalOpen(open)
                if (!open) setEditingStudent(null)
              }}
              student={editingStudent}
              levels={levels}
              yearId={yearId}
              existingStudents={yearStudents}
              onSubmit={handleStudentFormSubmit}
              trigger={
                <Button style={{ backgroundColor: '#5A7085', color: 'white' }}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Inscrire un élève
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Table or Empty State */}
      {filteredStudents.length === 0 ? (
        <Card style={{ backgroundColor: 'white', border: `1px solid ${COLORS.neutral[200]}`, borderRadius: '10px' }}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              backgroundColor: COLORS.primary[50],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <UserIcon style={{ width: '32px', height: '32px', color: COLORS.primary[200] }} />
            </div>
            <h3 className="heading-3" style={{ color: COLORS.primary[700], marginBottom: '8px' }}>
              {searchQuery || selectedLevel !== "all" || filterInvalidNisu
                ? "Aucun élève trouvé"
                : "Aucun élève inscrit pour cette année"}
            </h3>
            <p className="body-base" style={{ color: COLORS.neutral[500], marginBottom: '24px', textAlign: 'center' }}>
              {searchQuery || selectedLevel !== "all" || filterInvalidNisu
                ? "Essayez de modifier vos critères de recherche"
                : "Commencez par inscrire le premier élève"}
            </p>
            {!searchQuery && selectedLevel === "all" && !filterInvalidNisu && !isArchived && (
              <Button 
                onClick={() => setIsCreateModalOpen(true)}
                style={{ backgroundColor: COLORS.primary[500], color: 'white' }}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Inscrire un élève
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card style={{ backgroundColor: 'white', border: `1px solid ${COLORS.neutral[200]}`, borderRadius: '10px' }}>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: COLORS.primary[50], borderBottom: `1px solid ${COLORS.neutral[200]}` }}>
                    <TableHead 
                      className="font-sans" 
                      style={{ 
                        fontSize: '13px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: COLORS.primary[600] 
                      }}
                    >
                      Photo
                    </TableHead>
                    <TableHead 
                      className="font-sans" 
                      style={{ 
                        fontSize: '13px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: COLORS.primary[600] 
                      }}
                    >
                      Code
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('nisu')}
                        className="flex items-center gap-2 font-sans"
                        style={{ 
                          fontSize: '13px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: COLORS.primary[600] 
                        }}
                      >
                        NISU
                        {sortColumn === 'nisu' && (
                          sortDirection === 'asc' ? 
                            <ArrowUpIcon style={{ width: '16px', height: '16px', color: COLORS.primary[500] }} /> : 
                            <ArrowDownIcon style={{ width: '16px', height: '16px', color: COLORS.primary[500] }} />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('fullName')}
                        className="flex items-center gap-2 font-sans"
                        style={{ 
                          fontSize: '13px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: COLORS.primary[600] 
                        }}
                      >
                        Nom
                        {sortColumn === 'fullName' && (
                          sortDirection === 'asc' ? 
                            <ArrowUpIcon style={{ width: '16px', height: '16px', color: COLORS.primary[500] }} /> : 
                            <ArrowDownIcon style={{ width: '16px', height: '16px', color: COLORS.primary[500] }} />
                        )}
                      </button>
                    </TableHead>
                    <TableHead 
                      className="font-sans" 
                      style={{ 
                        fontSize: '13px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: COLORS.primary[600] 
                      }}
                    >
                      Prénom
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('gender')}
                        className="flex items-center gap-2 font-sans"
                        style={{ 
                          fontSize: '13px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: COLORS.primary[600] 
                        }}
                      >
                        Sexe
                        {sortColumn === 'gender' && (
                          sortDirection === 'asc' ? 
                            <ArrowUpIcon style={{ width: '16px', height: '16px', color: COLORS.primary[500] }} /> : 
                            <ArrowDownIcon style={{ width: '16px', height: '16px', color: COLORS.primary[500] }} />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('classroom')}
                        className="flex items-center gap-2 font-sans"
                        style={{ 
                          fontSize: '13px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: COLORS.primary[600] 
                        }}
                      >
                        Classe / Salle
                        {sortColumn === 'classroom' && (
                          sortDirection === 'asc' ? 
                            <ArrowUpIcon style={{ width: '16px', height: '16px', color: COLORS.primary[500] }} /> : 
                            <ArrowDownIcon style={{ width: '16px', height: '16px', color: COLORS.primary[500] }} />
                        )}
                      </button>
                    </TableHead>
                    <TableHead 
                      className="font-sans" 
                      style={{ 
                        fontSize: '13px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: COLORS.primary[600] 
                      }}
                    >
                      Statut
                    </TableHead>
                    <TableHead 
                      className="text-center font-sans" 
                      style={{ 
                        fontSize: '13px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: COLORS.primary[600] 
                      }}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.map((student) => {
                    const hasInvalidNisu = !student.nisu || !/^\d{12}$/.test(student.nisu)
                    const isInactive = inactiveStudentIds.includes(student.id)
                    const status = getStudentStatus(student)
                    const studentCode = student.studentCode || 'N/A'
                    
                    return (
                      <TableRow 
                        key={student.id} 
                        className={cn(isInactive && "opacity-60")}
                        style={{ 
                          borderBottom: `1px solid ${COLORS.neutral[200]}`,
                          backgroundColor: 'white'
                        }}
                        onMouseEnter={(e) => {
                          if (!isInactive) e.currentTarget.style.backgroundColor = COLORS.secondary[50]
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white'
                        }}
                      >
                        <TableCell>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={student.avatar} />
                            <AvatarFallback style={{ backgroundColor: COLORS.neutral[200] }}>
                              <UserIcon style={{ width: '20px', height: '20px', color: COLORS.neutral[400] }} />
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono caption" style={{ color: COLORS.neutral[600] }}>
                            {studentCode}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span style={{ 
                              color: hasInvalidNisu ? COLORS.error.main : COLORS.neutral[900],
                              fontWeight: hasInvalidNisu ? 500 : 400
                            }}>
                              {student.nisu || '—'}
                            </span>
                            {hasInvalidNisu && (
                              <span className="caption" style={{ color: COLORS.error.main }}>
                                NISU invalide — 12 chiffres requis
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell 
                          className="font-sans" 
                          style={{ 
                            fontSize: '14px',
                            fontWeight: 600,
                            color: COLORS.neutral[900] 
                          }}
                        >
                          {student.lastName}
                        </TableCell>
                        <TableCell 
                          className="font-sans" 
                          style={{ 
                            fontSize: '14px',
                            fontWeight: 400,
                            color: COLORS.neutral[900] 
                          }}
                        >
                          {student.firstName}
                        </TableCell>
                        <TableCell 
                          className="font-sans" 
                          style={{ 
                            fontSize: '14px',
                            fontWeight: 400,
                            color: COLORS.neutral[600] 
                          }}
                        >
                          {student.gender === 'M' ? 'Masculin' : 'Féminin'}
                        </TableCell>
                        <TableCell 
                          className="font-sans" 
                          style={{ 
                            fontSize: '14px',
                            fontWeight: 400,
                            color: COLORS.neutral[600] 
                          }}
                        >
                          {getClassAndSalle(student.levelId, student.classroomId)}
                        </TableCell>
                        <TableCell>
                          {status === 'active' && (
                            <Badge style={{ 
                              backgroundColor: COLORS.success.light, 
                              color: COLORS.success.main,
                              border: 'none'
                            }}>
                              Actif
                            </Badge>
                          )}
                          {status === 'incomplete' && (
                            <Badge style={{ 
                              backgroundColor: COLORS.warning.light, 
                              color: COLORS.warning.main,
                              border: 'none'
                            }}>
                              Incomplet
                            </Badge>
                          )}
                          {status === 'deactivated' && (
                            <Badge style={{ 
                              backgroundColor: COLORS.neutral[100], 
                              color: COLORS.neutral[500],
                              border: 'none'
                            }}>
                              Désactivé
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {!isArchived && (
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => handleEdit(student)}
                                disabled={isInactive}
                                className="caption"
                                style={{ 
                                  color: isInactive ? COLORS.neutral[400] : COLORS.neutral[700],
                                  cursor: isInactive ? 'not-allowed' : 'pointer',
                                  background: 'none',
                                  border: 'none',
                                  padding: '4px 8px',
                                  fontWeight: 500
                                }}
                              >
                                Modifier
                              </button>
                              {isInactive ? (
                                <button
                                  onClick={() => handleReactivate(student.id)}
                                  className="caption"
                                  style={{ 
                                    color: COLORS.success.main,
                                    cursor: 'pointer',
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px 8px',
                                    fontWeight: 500
                                  }}
                                >
                                  Réactiver
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDeactivate(student)}
                                  className="caption"
                                  style={{ 
                                    color: '#B91C1C',
                                    cursor: 'pointer',
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px 8px',
                                    fontWeight: 500
                                  }}
                                >
                                  Désactiver
                                </button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{ borderColor: COLORS.neutral[300], color: COLORS.neutral[600] }}
              >
                ← Précédent
              </Button>
              <span className="body-base" style={{ color: COLORS.neutral[500] }}>
                Page {currentPage} sur {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{ borderColor: COLORS.neutral[300], color: COLORS.neutral[600] }}
              >
                Suivant →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivation Modal */}
      <Dialog open={!!deactivatingStudent} onOpenChange={(open) => !open && setDeactivatingStudent(null)}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
          <DialogHeader>
            <DialogTitle 
              className="font-serif" 
              style={{ 
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: COLORS.primary[800] 
              }}
            >
              Désactiver cet élève
            </DialogTitle>
          </DialogHeader>
          
          {/* Warning block - amber background */}
          <div 
            className="font-sans" 
            style={{ 
              backgroundColor: '#FEF6E0',
              border: '1px solid #F59E0B',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 400,
              color: '#92400E',
              marginTop: '16px'
            }}
          >
            Cet élève ne sera plus visible dans les listes actives.
          </div>

          {/* Info block - green background */}
          <div 
            className="font-sans" 
            style={{ 
              backgroundColor: '#E8F5EC',
              border: '1px solid #2D7D46',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 400,
              color: '#166534',
              marginTop: '12px'
            }}
          >
            Cette action est réversible — vous pouvez réactiver l'élève à tout moment.
          </div>

          {deactivatingStudent && (
            <div className="py-4 space-y-4">
              <div>
                <span 
                  className="font-sans" 
                  style={{ 
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'hsl(var(--muted-foreground))'
                  }}
                >
                  Élève :{' '}
                </span>
                <span 
                  className="font-sans" 
                  style={{ 
                    fontSize: '15px',
                    fontWeight: 600,
                    color: COLORS.primary[800]
                  }}
                >
                  {deactivatingStudent.firstName} {deactivatingStudent.lastName}
                </span>
              </div>
              <div className="space-y-2">
                <Label 
                  htmlFor="deactivation-reason" 
                  className="font-sans" 
                  style={{ 
                    fontSize: '13px',
                    fontWeight: 500
                  }}
                >
                  Raison (optionnelle)
                </Label>
                <Input
                  id="deactivation-reason"
                  placeholder="Ex: Déménagement, transfert..."
                  value={deactivationReason}
                  onChange={(e) => setDeactivationReason(e.target.value)}
                  style={{ borderColor: COLORS.neutral[300] }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeactivatingStudent(null)}
              style={{ borderColor: COLORS.neutral[300], color: COLORS.neutral[600] }}
            >
              Annuler
            </Button>
            <Button 
              onClick={confirmDeactivation}
              style={{ backgroundColor: '#B91C1C', color: 'white' }}
            >
              Confirmer la désactivation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}