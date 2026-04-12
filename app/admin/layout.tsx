"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboardIcon,
  CalendarIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
  BellIcon,
  ChevronDownIcon,
  UsersIcon,
  ClipboardEditIcon,
  FileTextIcon,
  SchoolIcon,
  SettingsIcon,
  BuildingIcon,
  UserIcon,
  LockIcon,
  HelpCircleIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  ArchiveIcon
} from "lucide-react"
import { getMe, logout, type AuthUser } from "@/lib/data/auth-data"
import { fetchActiveAcademicYear, type AcademicYear } from "@/lib/api/dashboard"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { NotificationPanel } from "@/components/school/notification-panel"
import { Toaster } from "@/components/ui/toaster"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  section?: string
  children?: NavItem[]
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboardIcon },
  {
    label: "GESTION SCOLAIRE",
    section: "gestion",
    icon: SchoolIcon,
    children: [
      { label: "Élèves",    href: "/admin/academic-year/:yearId/students", icon: UsersIcon },
      { label: "Notes",     href: "/admin/academic-year/:yearId/grades",   icon: ClipboardEditIcon },
      { label: "Bulletins", href: "/admin/academic-year/:yearId/reports",  icon: FileTextIcon },
    ],
  },
  {
    label: "ARCHIVES",
    section: "archives",
    icon: ArchiveIcon,
    children: [
      { label: "Bulletins archivés", href: "/admin/archives", icon: ArchiveIcon },
    ],
  },
  {
    label: "PARAMÉTRAGE",
    section: "params",
    icon: SettingsIcon,
    children: [
      { label: "Établissement",    href: "/admin/settings",        icon: BuildingIcon },
      { label: "Années Scolaires", href: "/admin/academic-years",  icon: CalendarIcon },
    ],
  },
]

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null)
  const [yearLoading, setYearLoading] = useState(true)

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    getMe().then(user => {
      if (!user) {
        router.push('/login')
      } else {
        setCurrentUser(user)
        setAuthLoading(false)
      }
    })
  }, [router])

  // ── Année active ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchActiveAcademicYear()
      .then(year => setActiveYear(year))
      .catch(() => setActiveYear(null))
      .finally(() => setYearLoading(false))
  }, [])

  const [notifications, setNotifications] = useState([
    { id: "1", type: "warning"  as const, title: "7ème AF — Aucune note saisie",    subtitle: "2ème Étape en cours",   timestamp: "il y a 2h",  isRead: false },
    { id: "2", type: "warning"  as const, title: "3 élèves sans photo",             subtitle: "Classe 9ème AF",         timestamp: "il y a 5h",  isRead: false },
    { id: "3", type: "success"  as const, title: "Étape 1 clôturée — 6ème AF",      subtitle: "Bulletins disponibles", timestamp: "hier 14h32", isRead: true  },
    { id: "4", type: "success"  as const, title: "Bulletin généré — Martine Simon", subtitle: "6ème AF · Étape 1",     timestamp: "hier 11h15", isRead: true  },
  ])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationPanelOpen(false)
      }
    }
    if (notificationPanelOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [notificationPanelOpen])

  const handleMarkAllRead = () =>
    setNotifications(n => n.map(x => ({ ...x, isRead: true })))

  const handleNotificationClick = (id: string) =>
    setNotifications(n => n.map(x => x.id === id ? { ...x, isRead: true } : x))

  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const getNavHref = (href?: string) => {
    if (!href) return "#"
    if (href.includes(":yearId")) {
      if (yearLoading || !activeYear?.id) return "#"
      return href.replace(":yearId", activeYear.id)
    }
    return href
  }

  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "#FAFAF8"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "32px", height: "32px", border: "3px solid #E8E6E3",
            borderTopColor: "#5A7085", borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 12px"
          }} />
          <p className="font-sans" style={{ fontSize: "13px", color: "#78756F" }}>
            Vérification de la session...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const getLinkStyles = (isActive: boolean, paddingLeft: string, mobile: boolean, item: NavItem) => ({
    paddingLeft: sidebarCollapsed && !mobile ? "0" : paddingLeft,
    backgroundColor: isActive ? "rgba(255,255,255,0.08)" : "transparent",
    color: isActive ? "#FFFFFF" : "#CBD5E1",
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
    fontWeight: isActive ? 600 : (item.href ? 500 : 400),
    borderLeft: isActive ? "3px solid #FFFFFF" : "3px solid transparent",
    borderRadius: isActive ? "0 6px 6px 0" : "0",
    marginLeft: "-3px",
  })

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>, isActive: boolean) => {
    if (!isActive) e.currentTarget.style.borderLeft = "2px solid #8FA8C0"
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>, isActive: boolean) => {
    if (!isActive) e.currentTarget.style.borderLeft = "3px solid transparent"
  }

  const createLinkContent = (item: NavItem, href: string, isActive: boolean, mobile: boolean, paddingLeft: string) => {
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={href}
        onClick={() => mobile && setSidebarOpen(false)}
        className={cn("flex items-center py-2 transition-all duration-200",
          sidebarCollapsed && !mobile ? "justify-center" : "gap-3"
        )}
        style={getLinkStyles(isActive, paddingLeft, mobile, item)}
        onMouseEnter={e => handleMouseEnter(e, isActive)}
        onMouseLeave={e => handleMouseLeave(e, isActive)}
      >
        <Icon className="h-4 w-4" />
        {(!sidebarCollapsed || mobile) && <span>{item.label}</span>}
      </Link>
    )
  }

  const renderNavLink = (item: NavItem, mobile: boolean, paddingLeft: string) => {
    const href = getNavHref(item.href)
    const isActive = pathname === href || pathname.startsWith(href.split("?")[0])
    const linkContent = createLinkContent(item, href, isActive, mobile, paddingLeft)

    if (sidebarCollapsed && !mobile) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right"><p>{item.label}</p></TooltipContent>
        </Tooltip>
      )
    }
    return linkContent
  }

  const renderSectionHeader = (label: string, mobile: boolean) => {
    return (!sidebarCollapsed || mobile) ? (
      <div className="px-3 py-2" style={{
        fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.08em", color: "#8FA8C0", cursor: "default",
      }}>
        {label}
      </div>
    ) : null
  }

  const renderSectionWithChildren = (item: NavItem, index: number, mobile: boolean) => (
    <div key={index} style={{ marginTop: index > 0 ? "24px" : "0" }}>
      {renderSectionHeader(item.label, mobile)}
      <div className="mt-1 space-y-1">
        {item.children?.map(child => renderNavLink(child, mobile, "16px"))}
      </div>
    </div>
  )

  const SidebarNav = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navItems.map((item, index) => {
        if (item.section && item.children) {
          return renderSectionWithChildren(item, index, mobile)
        }
        if (item.href) {
          return renderNavLink(item, mobile, "12px")
        }
        return null
      })}
    </nav>
  )

  return (
    <TooltipProvider>
      <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: "#FAFAF8" }}>

        {/* Sidebar Desktop */}
        <aside
          className="hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col overflow-hidden transition-all duration-300"
          style={{ width: sidebarCollapsed ? "64px" : "256px" }}
        >
          <div className="flex flex-col h-full" style={{ backgroundColor: "#2A3740" }}>
            <div className="h-16 flex items-center justify-between px-3" style={{ borderBottom: "1px solid #3A4A57" }}>
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <div className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#5A7085" }}>
                  <span className="text-sm font-bold" style={{ color: "#C3B594" }}>SL</span>
                </div>
                {!sidebarCollapsed && (
                  <span className="font-sans font-bold truncate" style={{ color: "#D9E3EA", fontSize: "16px" }}>CPMSL</span>
                )}
              </div>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/10"
                style={{ color: "#8FA8C0" }}
              >
                {sidebarCollapsed
                  ? <PanelLeftOpenIcon className="h-4 w-4" />
                  : <PanelLeftCloseIcon className="h-4 w-4" />}
              </button>
            </div>
            <SidebarNav />
          </div>
        </aside>

        {/* Sidebar Mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="fixed inset-0 bg-black/50 border-0 p-0 cursor-default" onClick={() => setSidebarOpen(false)} />            <aside className="fixed inset-y-0 left-0 w-72 z-50" style={{ backgroundColor: "#2A3740", borderRight: "1px solid #3A4A57" }}>
              <div className="flex flex-col h-full">
                <div className="h-16 flex items-center justify-between px-4" style={{ borderBottom: "1px solid #3A4A57" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#5A7085" }}>
                      <span className="text-sm font-bold" style={{ color: "#C3B594" }}>SL</span>
                    </div>
                    <span className="font-sans font-bold" style={{ color: "#D9E3EA", fontSize: "16px" }}>CPMSL</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)} className="h-8 w-8 p-0">
                    <XIcon className="h-5 w-5" />
                  </Button>
                </div>
                <SidebarNav mobile />
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <div className="w-full transition-all duration-300" style={{ paddingLeft: sidebarCollapsed ? "64px" : "256px" }}>
          {/* Header */}
          <header className="sticky top-0 z-40 h-16" style={{ backgroundColor: "white", borderBottom: "1px solid #E8E6E3" }}>
            <div className="flex items-center justify-between h-full px-4 gap-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} className="lg:hidden h-9 w-9 p-0">
                  <MenuIcon className="h-5 w-5" />
                </Button>
                <h1 className="heading-3 text-[#1f1a18]">CPMSL</h1>
              </div>

              <div className="flex-1" />

              <div className="flex items-center gap-2">

                {/* Année scolaire active */}
                <div className="hidden md:flex items-center px-3 py-1.5 rounded-md"
                  style={{ backgroundColor: "#F0F4F7", fontSize: "13px", color: "#3A4A57", fontWeight: 500 }}>
                  {yearLoading ? "..." : (activeYear?.name ?? "—")}
                </div>

                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                  <Button
                    variant="ghost" size="sm"
                    className="relative h-9 w-9 p-0"
                    onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
                  >
                    <BellIcon className="h-5 w-5 text-[#5b6d77]" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
                    )}
                  </Button>
                  {notificationPanelOpen && (
                    <NotificationPanel
                      notifications={notifications}
                      onMarkAllRead={handleMarkAllRead}
                      onNotificationClick={handleNotificationClick}
                    />
                  )}
                </div>

                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 h-9">
                      <span className="hidden sm:inline body-base font-medium text-[#1f1a18]">
                        {currentUser?.firstname} {currentUser?.lastname}
                      </span>
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {currentUser?.firstname?.[0]}{currentUser?.lastname?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDownIcon className="h-4 w-4 text-[#5b6d77]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>
                      <div>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, color: "#1E1A17" }}>
                          {currentUser?.firstname} {currentUser?.lastname}
                        </p>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "#78756F" }}>
                          Administrateur
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem style={{ fontFamily: "var(--font-sans)", fontSize: "14px", padding: "8px 16px" }}>
                      <UserIcon className="mr-2 h-4 w-4" /> Profil / Mon compte
                    </DropdownMenuItem>
                    <DropdownMenuItem style={{ fontFamily: "var(--font-sans)", fontSize: "14px", padding: "8px 16px" }}>
                      <LockIcon className="mr-2 h-4 w-4" /> Changer mot de passe
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem style={{ fontFamily: "var(--font-sans)", fontSize: "14px", padding: "8px 16px" }}>
                      <SettingsIcon className="mr-2 h-4 w-4" /> Paramètres système
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem style={{ fontFamily: "var(--font-sans)", fontSize: "14px", padding: "8px 16px" }}>
                      <HelpCircleIcon className="mr-2 h-4 w-4" /> Aide / Support
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      style={{ fontFamily: "var(--font-sans)", fontSize: "14px", padding: "8px 16px", color: "#B91C1C" }}
                    >
                      <LogOutIcon className="mr-2 h-4 w-4" /> Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="p-4 sm:p-6 lg:p-8 lg:pt-6 max-w-full">
            {children}
          </main>
        </div>

        <Toaster />
      </div>
    </TooltipProvider>
  )
}