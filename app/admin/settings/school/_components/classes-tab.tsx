// app/admin/settings/school/_components/classes-tab.tsx
"use client"

import { Button }   from "@/components/ui/button"
import { Badge }    from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ZapIcon, CheckCircle2Icon } from "lucide-react"
import { type ClassType, type Class } from "../_hooks/use-school-settings"

const TH = { fontSize:'12px', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'#2C4A6E' }

interface ClassesTabProps {
  loading: boolean
  classTypes: ClassType[]
  classes: Class[]
  initializing: boolean
  onInitialize: () => void
  onEditClass: (c: Class) => void
}

export function ClassesTab({ loading, classTypes, classes, initializing, onInitialize, onEditClass }: ClassesTabProps) {
  if (loading) return <Skeleton className="h-64 w-full" />

  const classesInitialized = classes.length > 0

  return (
    <div style={{ backgroundColor:'#FFFFFF', borderRadius:'10px', border:'1px solid #E8E6E3', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ padding:'20px 24px', borderBottom:'1px solid #E8E6E3', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h3 style={{ fontFamily:'var(--font-serif)', fontSize:'18px', fontWeight:600, color:'#2A3740' }}>
            Classes ({classes.length} / {classTypes.length || 13})
          </h3>
          <p style={{ fontSize:'13px', color:'#78756F', marginTop:'2px' }}>Référentiel permanent — salle A par défaut pour chaque niveau</p>
        </div>
        {classTypes.length === 0 && (
          <Button onClick={onInitialize} disabled={initializing}
            style={{ backgroundColor:'#2C4A6E', color:'white', borderRadius:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
            <ZapIcon className="h-4 w-4" />{initializing ? 'Initialisation...' : 'Initialiser niveaux & classes'}
          </Button>
        )}
        {classesInitialized && (
          <div className="flex items-center gap-2" style={{ color:'#2D7D46', fontSize:'13px', fontWeight:500 }}>
            <CheckCircle2Icon className="h-4 w-4" />Classes initialisées
          </div>
        )}
      </div>

      <div style={{ padding:'24px' }}>
        {classTypes.length === 0
          ? (
            <div style={{ textAlign:'center', padding:'48px 24px' }}>
              <p style={{ fontSize:'16px', fontWeight:600, color:'#3A4A57', marginBottom:'8px' }}>Aucun niveau configuré</p>
              <p style={{ fontSize:'13px', color:'#78756F', marginBottom:'24px' }}>
                Cliquez sur &quot;Initialiser niveaux &amp; classes&quot; pour créer les 13 niveaux MENFP.
              </p>
              <Button onClick={onInitialize} disabled={initializing}
                style={{ backgroundColor:'#2C4A6E', color:'white', borderRadius:'8px', display:'inline-flex', alignItems:'center', gap:'8px' }}>
                <ZapIcon className="h-4 w-4" />{initializing ? 'Initialisation en cours...' : 'Initialiser niveaux & classes'}
              </Button>
            </div>
          )
          : (
            <div style={{ borderRadius:'8px', border:'1px solid #E8E6E3', overflow:'hidden' }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor:'#F1F5F9', borderBottom:'2px solid #D1D5DB' }}>
                    <TableHead style={TH}>Niveau</TableHead>
                    <TableHead style={TH}>Type</TableHead>
                    <TableHead style={TH}>Max élèves</TableHead>
                    <TableHead style={{ ...TH, textAlign:'center' }}>Statut</TableHead>
                    <TableHead style={{ ...TH, textAlign:'center' }}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classTypes.map((ct, i) => {
                    const cls = classes.find(c => c.classTypeId === ct.id)
                    return (
                      <TableRow key={ct.id} style={{ borderTop:i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                        <TableCell style={{ fontWeight:700, color:'#1E1A17', fontSize:'14px' }}>{ct.name}</TableCell>
                        <TableCell>
                          {ct.isTerminal
                            ? <Badge style={{ backgroundColor:'#FEF6E0', color:'#C48B1A', border:'none', fontSize:'11px' }}>Examen</Badge>
                            : <Badge style={{ backgroundColor:'#F0F4F7', color:'#5A7085', border:'none', fontSize:'11px' }}>Standard</Badge>}
                        </TableCell>
                        <TableCell style={{ fontSize:'13px', color:'#78756F' }}>{cls?.maxStudents ?? '—'}</TableCell>
                        <TableCell style={{ textAlign:'center' }}>
                          {cls
                            ? <Badge style={{ backgroundColor:'#E8F5EC', color:'#2D7D46', border:'none', fontSize:'11px' }}>✓ Créée</Badge>
                            : <Badge style={{ backgroundColor:'#FEF6E0', color:'#C48B1A', border:'none', fontSize:'11px' }}>En attente</Badge>}
                        </TableCell>
                        <TableCell style={{ textAlign:'center' }}>
                          {cls
                            ? <button onClick={() => onEditClass(cls)} style={{ fontSize:'13px', fontWeight:500, color:'#5A7085', background:'none', border:'none', cursor:'pointer' }}>Modifier</button>
                            : <span style={{ color:'#D1CECC', fontSize:'13px' }}>—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
      </div>
    </div>
  )
}