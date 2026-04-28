"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  CalendarIcon,
  LogOutIcon,
  BellIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  UsersIcon,
  ClipboardEditIcon,
  FileTextIcon,
  SchoolIcon,
  SettingsIcon,
  BuildingIcon,
  UserIcon,
  LockIcon,
  ArchiveIcon,
  CheckIcon,
} from "lucide-react";
import { getMe, type AuthUser } from "@/lib/data/auth-data";
import {
  fetchActiveAcademicYear,
  type AcademicYear,
} from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";
import { NotificationPanel } from "@/components/school/notification-panel";
import { ProfileDialog } from "@/components/school/profile-dialog";
import { Toaster } from "@/components/ui/toaster";

/* ─────────────────────────── Nav config ─────────────────────────── */

interface NavChild {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  children: NavChild[];
}

interface NavLink {
  label: string;
  href: string;
  icon: React.ElementType;
}

type NavItem = NavLink | NavGroup;

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboardIcon },
  {
    label: "Gestion Scolaire",
    icon: SchoolIcon,
    children: [
      {
        label: "Élèves",
        href: "/admin/academic-year/:yearId/students",
        icon: UsersIcon,
      },
      {
        label: "Notes",
        href: "/admin/academic-year/:yearId/grades",
        icon: ClipboardEditIcon,
      },
      {
        label: "Bulletins",
        href: "/admin/academic-year/:yearId/reports",
        icon: FileTextIcon,
      },
    ],
  },
  {
    label: "Archives",
    icon: ArchiveIcon,
    children: [
      {
        label: "Bulletins archivés",
        href: "/admin/archives",
        icon: ArchiveIcon,
      },
    ],
  },
  {
    label: "Paramétrage",
    icon: SettingsIcon,
    children: [
      { label: "Établissement", href: "/admin/settings", icon: BuildingIcon },
      {
        label: "Années Scolaires",
        href: "/admin/academic-years",
        icon: CalendarIcon,
      },
    ],
  },
];

function isNavGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

/* ────────────────────── Breadcrumb helper ────────────────────── */

const breadcrumbMap: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/academic-years": "Années Scolaires",
  "/admin/settings": "Établissement",
  "/admin/archives": "Bulletins archivés",
};

function getBreadcrumbLabel(pathname: string): string {
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname];
  if (pathname.includes("/students")) return "Élèves";
  if (pathname.includes("/grades")) return "Notes";
  if (pathname.includes("/reports")) return "Bulletins";
  if (pathname.includes("/config")) return "Configuration";
  return "Page";
}

/* ─────────────────────────── Layout Shell ─────────────────────────── */

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [yearLoading, setYearLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    getMe().then((user) => {
      if (!user) {
        router.push("/login");
      } else {
        setCurrentUser(user);
        setAuthLoading(false);
      }
    });
  }, [router]);

  // ── Année active ──
  useEffect(() => {
    fetchActiveAcademicYear()
      .then((year) => setActiveYear(year))
      .catch(() => setActiveYear(null))
      .finally(() => setYearLoading(false));
  }, []);

  // ── Notifications (demo) ──
  const [notifications, setNotifications] = useState([
    {
      id: "1",
      type: "warning" as const,
      title: "7ème AF — Aucune note saisie",
      subtitle: "2ème Étape en cours",
      timestamp: "il y a 2h",
      isRead: false,
    },
    {
      id: "2",
      type: "warning" as const,
      title: "3 élèves sans photo",
      subtitle: "Classe 9ème AF",
      timestamp: "il y a 5h",
      isRead: false,
    },
    {
      id: "3",
      type: "success" as const,
      title: "Étape 1 clôturée — 6ème AF",
      subtitle: "Bulletins disponibles",
      timestamp: "hier 14h32",
      isRead: true,
    },
    {
      id: "4",
      type: "success" as const,
      title: "Bulletin généré — Martine Simon",
      subtitle: "6ème AF · Étape 1",
      timestamp: "hier 11h15",
      isRead: true,
    },
  ]);

  const handleMarkAllRead = () =>
    setNotifications((n) => n.map((x) => ({ ...x, isRead: true })));

  const handleNotificationClick = (id: string) =>
    setNotifications((n) =>
      n.map((x) => (x.id === id ? { ...x, isRead: true } : x)),
    );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const getNavHref = (href: string) => {
    if (href.includes(":yearId")) {
      if (yearLoading || !activeYear?.id) return "#";
      return href.replace(":yearId", activeYear.id);
    }
    return href;
  };

  const isChildActive = (children: NavChild[]) =>
    children.some((c) => {
      const href = getNavHref(c.href);
      return pathname === href || pathname.startsWith(href.split("?")[0]);
    });

  const initials = `${currentUser?.firstname?.[0] ?? ""}${currentUser?.lastname?.[0] ?? ""}`;

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Chargement...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <SidebarProvider>
      {/* ── Sidebar ── */}
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {/* Logo/Header */}
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <SchoolIcon className="h-5 w-5" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold text-sidebar-foreground">
                CPMSL
              </span>
              <span className="truncate text-xs text-sidebar-foreground/60">
                Admin
              </span>
            </div>
          </Link>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent className="gap-0">
          <SidebarGroup className="px-0">
            <SidebarGroupLabel className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
              Navigation
            </SidebarGroupLabel>
            <SidebarMenu className="px-2">
              {navItems.map((item) => {
                if (!isNavGroup(item)) {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          "transition-colors",
                          isActive &&
                            "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                        )}
                      >
                        <Link href={item.href}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                const Icon = item.icon;
                const groupActive = isChildActive(item.children);
                return (
                  <Collapsible
                    key={item.label}
                    asChild
                    defaultOpen={groupActive}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.label}
                          className="transition-colors"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          <ChevronRightIcon className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-sidebar-foreground/40" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map((child) => {
                            const childHref = getNavHref(child.href);
                            const childActive =
                              pathname === childHref ||
                              pathname.startsWith(childHref.split("?")[0]);
                            const ChildIcon = child.icon;
                            return (
                              <SidebarMenuSubItem key={child.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={childActive}
                                  className={cn(
                                    "transition-colors",
                                    childActive &&
                                      "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                                  )}
                                >
                                  <Link href={childHref}>
                                    <ChildIcon className="h-3.5 w-3.5" />
                                    <span>{child.label}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Sidebar Footer (User) ── */}
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="transition-colors data-[state=open]:bg-sidebar-accent"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold text-sidebar-foreground">
                        {currentUser?.firstname} {currentUser?.lastname}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/50">
                        Administrateur
                      </span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4 text-sidebar-foreground/40" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56"
                  align="end"
                  side="top"
                  sideOffset={4}
                >
                  <DropdownMenuLabel>
                    <div>
                      <p className="text-sm font-semibold">
                        {currentUser?.firstname} {currentUser?.lastname}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Administrateur
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    <UserIcon className="mr-2 h-4 w-4" /> Profil / Mon compte
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    <LockIcon className="mr-2 h-4 w-4" /> Changer mot de passe
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/admin/settings")}
                  >
                    <SettingsIcon className="mr-2 h-4 w-4" /> Paramètres système
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="!text-destructive focus:!bg-destructive/10"
                  >
                    <LogOutIcon className="mr-2 h-4 w-4" /> Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Header bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-5" />

          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin/dashboard">Accueil</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {pathname !== "/admin/dashboard" && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {getBreadcrumbLabel(pathname)}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex-1" />

          {/* Active year badge */}
          <Badge
            variant="outline"
            className="hidden gap-1.5 text-xs font-medium md:inline-flex"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                activeYear ? "bg-emerald-500" : "bg-muted-foreground",
              )}
            />
            {yearLoading ? "..." : (activeYear?.name ?? "Aucune année")}
          </Badge>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8">
                <BellIcon className="h-4 w-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[380px] p-0"
              sideOffset={8}
            >
              <NotificationPanel
                notifications={notifications}
                onMarkAllRead={handleMarkAllRead}
                onNotificationClick={handleNotificationClick}
              />
            </PopoverContent>
          </Popover>

          {/* User dropdown (header) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 pl-2 pr-1 h-8"
              >
                <span className="hidden text-sm font-medium sm:inline">
                  {currentUser?.firstname}
                </span>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px] font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Mon compte
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <UserIcon className="mr-2 h-4 w-4" /> Profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="!text-destructive focus:!bg-destructive/10"
              >
                <LogOutIcon className="mr-2 h-4 w-4" /> Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 lg:pt-6">
          {children}
        </main>
      </div>

      {/* Profile dialog */}
      {currentUser && (
        <ProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          user={currentUser}
          onProfileUpdated={(updated) => setCurrentUser(updated)}
        />
      )}

      <Toaster />
    </SidebarProvider>
  );
}
