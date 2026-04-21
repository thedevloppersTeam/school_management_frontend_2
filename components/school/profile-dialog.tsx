"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Loader2Icon } from "lucide-react"
import type { AuthUser } from "@/lib/data/auth-data"
import { toMessage } from '@/lib/errors'

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AuthUser
  onProfileUpdated: (user: AuthUser) => void
}

export function ProfileDialog({
  open,
  onOpenChange,
  user,
  onProfileUpdated,
}: ProfileDialogProps) {
  const { toast } = useToast()

  // Profile form
  const [firstname, setFirstname] = useState(user.firstname)
  const [lastname, setLastname] = useState(user.lastname)
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  const initials = `${user.firstname?.[0] ?? ""}${user.lastname?.[0] ?? ""}`

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch("/api/users/update-my-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...user,
          firstname,
          lastname,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Erreur mise à jour")
      }
      toast({ title: "Profil mis à jour" })
      onProfileUpdated({ ...user, firstname, lastname })
    } catch (e) {
      toast({
        title: "Erreur",
        description: toMessage(e, "lors de la mise à jour du profil"),
        variant: "destructive",
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive",
      })
      return
    }
    if (newPassword.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive",
      })
      return
    }

    setSavingPassword(true)
    try {
      const res = await fetch("/api/users/update-my-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Erreur changement de mot de passe")
      }
      toast({ title: "Mot de passe modifié" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e) {
      toast({
        title: "Erreur",
        description: toMessage(e, "lors du changement de mot de passe"),
        variant: "destructive",
      })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Mon compte</DialogTitle>
          <DialogDescription>
            Gérez votre profil et votre mot de passe
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">
              {user.firstname} {user.lastname}
            </p>
            <p className="text-sm text-muted-foreground">
              {user.username}
            </p>
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="profile" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">
              Profil
            </TabsTrigger>
            <TabsTrigger value="password" className="flex-1">
              Mot de passe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="firstname">Prénom</Label>
              <Input
                id="firstname"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastname">Nom</Label>
              <Input
                id="lastname"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nom d&apos;utilisateur</Label>
              <Input value={user.username} disabled className="bg-muted" />
            </div>
            <DialogFooter>
              <Button
                onClick={handleSaveProfile}
                disabled={savingProfile || (!firstname.trim() || !lastname.trim())}
              >
                {savingProfile && (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                )}
                Enregistrer
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="password" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mot de passe actuel</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={
                  confirmPassword && newPassword !== confirmPassword
                    ? "border-destructive"
                    : ""
                }
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">
                  Les mots de passe ne correspondent pas
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={handleChangePassword}
                disabled={
                  savingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword !== confirmPassword
                }
              >
                {savingPassword && (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                )}
                Changer le mot de passe
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
