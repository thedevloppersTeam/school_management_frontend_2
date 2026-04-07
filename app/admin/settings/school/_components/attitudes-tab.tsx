// app/admin/settings/school/_components/attitudes-tab.tsx
"use client"

import { Button }   from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { type Attitude } from "../_hooks/use-school-settings"

const TH = { fontSize:'12px', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'#2C4A6E' }

interface AttitudesTabProps {
  loading: boolean
  attitudes: Attitude[]
  currentYearId: string | null
  onCreateAttitude: () => void
  onEditAttitude: (a: Attitude) => void
  onDeleteAttitude: (a: Attitude) => void
}

export function AttitudesTab({ loading, attitudes, currentYearId, onCreateAttitude, onEditAttitude, onDeleteAttitude }: AttitudesTabProps) {
  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div style={{ backgroundColor:'#FFFFFF', borderRadius:'10px', border:'1px solid #E8E6E3', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ padding:'20px 24px', borderBottom:'1px solid #E8E6E3', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h3 style={{ fontFamily:'var(--font-serif)', fontSize:'18px', fontWeight:600, color:'#2A3740' }}>Attitudes ({attitudes.length})</h3>
          <p style={{ fontSize:'13px', color:'#78756F', marginTop:'2px' }}>
            Caractéristiques de comportement évaluées pour l&apos;année active — Oui / Non par élève
          </p>
        </div>
        <Button onClick={onCreateAttitude} disabled={!currentYearId}
          title={!currentYearId ? "Aucune année active" : undefined}
          style={{ backgroundColor:!currentYearId ? '#9CA3AF' : '#2C4A6E', color:'white', borderRadius:'8px' }}>
          <PlusIcon className="mr-2 h-4 w-4" />Nouvelle attitude
        </Button>
      </div>

      {!currentYearId && (
        <div style={{ padding:'32px', textAlign:'center' }}>
          <p style={{ fontSize:'14px', color:'#C48B1A' }}>Aucune année scolaire active. Activez une année dans la configuration.</p>
        </div>
      )}

      {currentYearId && (
        <div style={{ padding:'24px' }}>
          {attitudes.length === 0
            ? (
              <div style={{ textAlign:'center', padding:'48px 24px', border:'1px dashed #D1CECC', borderRadius:'8px' }}>
                <p style={{ fontSize:'15px', fontWeight:600, color:'#3A4A57', marginBottom:'6px' }}>Aucune attitude configurée</p>
                <p style={{ fontSize:'13px', color:'#78756F', marginBottom:'20px' }}>
                  Ajoutez les attitudes à évaluer pour cette année.<br />
                  Exemples : Respectueux(se), Ponctuel(le), Attentif(ve)
                </p>
                <Button onClick={onCreateAttitude} style={{ backgroundColor:'#2C4A6E', color:'white', borderRadius:'8px' }}>
                  <PlusIcon className="mr-2 h-4 w-4" />Créer la première attitude
                </Button>
              </div>
            )
            : (
              <div style={{ borderRadius:'8px', border:'1px solid #E8E6E3', overflow:'hidden' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor:'#F1F5F9', borderBottom:'2px solid #D1D5DB' }}>
                      <TableHead style={TH}>#</TableHead>
                      <TableHead style={TH}>Libellé</TableHead>
                      <TableHead style={{ ...TH, textAlign:'center' }}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attitudes.map((att, i) => (
                      <TableRow key={att.id} style={{ borderTop:i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                        <TableCell style={{ width:'48px', color:'#A8A5A2', fontSize:'13px', fontWeight:500 }}>{i + 1}</TableCell>
                        <TableCell style={{ fontWeight:600, color:'#1E1A17', fontSize:'14px' }}>{att.label}</TableCell>
                        <TableCell style={{ textAlign:'center' }}>
                          <div className="flex items-center justify-center gap-3">
                            <button onClick={() => onEditAttitude(att)} style={{ fontSize:'13px', fontWeight:500, color:'#5A7085', background:'none', border:'none', cursor:'pointer' }}>
                              Modifier
                            </button>
                            <span style={{ color:'#D1CECC' }}>|</span>
                            <button onClick={() => onDeleteAttitude(att)} style={{ fontSize:'13px', fontWeight:500, color:'#C43C3C', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Trash2Icon className="h-3.5 w-3.5" />Supprimer
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </div>
      )}
    </div>
  )
}