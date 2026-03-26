"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UploadIcon } from "lucide-react"
import type { SchoolInfo } from "@/lib/data/school-data"

interface CPMSLSchoolInfoFormProps {
  schoolInfo: SchoolInfo
  onSave: (info: SchoolInfo) => void
}

export function CPMSLSchoolInfoForm({ schoolInfo, onSave }: CPMSLSchoolInfoFormProps) {
  const [editedInfo, setEditedInfo] = useState<SchoolInfo>(schoolInfo)

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setEditedInfo({ ...editedInfo, logo: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="space-y-6">
      {/* Card 1 - Identité */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 600, color: "#2C4A6E", borderLeft: "3px solid #2C4A6E", paddingLeft: "12px", marginBottom: "8px" }}>Identité de l'école</h3>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))", paddingLeft: "15px" }}>Informations d'identification de l'établissement</p>
        </div>
        <div style={{ padding: "24px" }} className="space-y-5">
          {/* Logo */}
          <div className="space-y-2">
            <Label className="label-ui" style={{ color: "#1E1A17" }}>Logo</Label>
            <div className="flex items-center gap-4" style={{ width: "60%" }}>
              <Avatar className="h-24 w-24 rounded-xl">
                {editedInfo.logo ? (
                  <AvatarImage src={editedInfo.logo} alt="Logo" className="object-cover" />
                ) : (
                  <AvatarFallback className="rounded-xl text-2xl font-bold" style={{ backgroundColor: "#F0F4F7", color: "#5A7085" }}>
                    CPMSL
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="logo-upload" className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors" style={{ borderColor: "#B3C7D5" }}>
                  <UploadIcon className="h-4 w-4" style={{ color: "#78756F" }} />
                  <span className="label-ui" style={{ color: "#78756F" }}>Télécharger un logo</span>
                </Label>
                <input id="logo-upload" type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} className="hidden" />
                <p className="caption" style={{ color: "#A8A5A2", marginTop: "4px" }}>PNG ou JPG, max 2 Mo</p>
              </div>
            </div>
          </div>

          {/* Nom */}
          <div className="space-y-2">
            <Label className="label-ui" style={{ color: "#1E1A17" }}>
              Nom de l'école <span style={{ color: "#C43C3C" }}>*</span>
            </Label>
            <Input value={editedInfo.name} onChange={(e) => setEditedInfo({ ...editedInfo, name: e.target.value })} style={{ borderColor: "#D1CECC", borderRadius: "8px" }} />
          </div>

          {/* Devise */}
          <div className="space-y-2">
            <Label className="label-ui" style={{ color: "#1E1A17" }}>Devise</Label>
            <Input value={editedInfo.motto} onChange={(e) => setEditedInfo({ ...editedInfo, motto: e.target.value })} placeholder="Ex: L'excellence avant tout" style={{ borderColor: "#D1CECC", borderRadius: "8px" }} />
          </div>

          {/* Fondée en */}
          <div className="space-y-2" style={{ width: "25%" }}>
            <Label className="label-ui" style={{ color: "#1E1A17" }}>Fondée en</Label>
            <Input type="number" value={editedInfo.foundedYear} onChange={(e) => setEditedInfo({ ...editedInfo, foundedYear: parseInt(e.target.value) })} style={{ borderColor: "#D1CECC", borderRadius: "8px" }} />
          </div>
        </div>
      </div>

      {/* Card 2 - Coordonnées */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginTop: "24px" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 600, color: "#2C4A6E", borderLeft: "3px solid #2C4A6E", paddingLeft: "12px", marginBottom: "8px" }}>Coordonnées</h3>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))", paddingLeft: "15px" }}>Informations de contact de l'établissement</p>
        </div>
        <div style={{ padding: "24px" }} className="space-y-5">
          {/* Adresse */}
          <div className="space-y-2">
            <Label className="label-ui" style={{ color: "#1E1A17" }}>Adresse complète</Label>
            <Textarea value={editedInfo.address} onChange={(e) => setEditedInfo({ ...editedInfo, address: e.target.value })} rows={2} className="resize-none" style={{ borderColor: "#D1CECC", borderRadius: "8px" }} />
          </div>

          {/* Téléphone */}
          <div className="space-y-2">
            <Label className="label-ui" style={{ color: "#1E1A17" }}>Téléphone</Label>
            <Input type="tel" value={editedInfo.phone} onChange={(e) => setEditedInfo({ ...editedInfo, phone: e.target.value })} style={{ borderColor: "#D1CECC", borderRadius: "8px" }} />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="label-ui" style={{ color: "#1E1A17" }}>Email</Label>
            <Input type="email" value={editedInfo.email} onChange={(e) => setEditedInfo({ ...editedInfo, email: e.target.value })} style={{ borderColor: "#D1CECC", borderRadius: "8px" }} />
          </div>
        </div>
      </div>

      {/* Bouton Enregistrer */}
      <div className="flex justify-end">
        <Button onClick={() => onSave(editedInfo)} style={{ backgroundColor: "#5A7085", color: "#FFFFFF", borderRadius: "8px", paddingLeft: "24px", paddingRight: "24px" }}>
          Enregistrer les modifications
        </Button>
      </div>
    </div>
  )
}