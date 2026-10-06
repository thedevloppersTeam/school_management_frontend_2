"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  UserPlusIcon,
  HistoryIcon,
  GraduationCapIcon,
  CopyIcon,
  CalendarCheckIcon,
} from "lucide-react";

import { getMe, logout, type AuthUser } from "@/lib/data/auth-data";
import {
  fetchActiveAcademicYear,
  type AcademicYear,
} from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";
import { SchoolLogo } from "@/components/school/school-logo";
import { ProfileDialog } from "@/components/school/profile-dialog";


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
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    label: "Inscription",
    icon: UserPlusIcon,
    children: [
      {
        label: "Élève",
        href: "/admin/all-students",
        icon: UsersIcon,
      },
    ],
  },
  {
    label: "Gestion Scolaire",
    icon: SchoolIcon,
    children: [
      {
        label: "Élèves inscrits",
        href: "/admin/academic-year/:yearId/students",
        icon: UserIcon,
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
    label: "Fin d'année",
    icon: CalendarCheckIcon,
    children: [
      {
        label: "Promotion des élèves",
        href: "/admin/fin-annee/promotion",
        icon: GraduationCapIcon,
      },
      {
        label: "Reprendre une année",
        href: "/admin/fin-annee/configuration",
        icon: CopyIcon,
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
      {
        label: "Journal",
        href: "/admin/journal",
        icon: HistoryIcon,
      },
    ],
  },
  {
    label: "Paramétrage",
    icon: SettingsIcon,
    children: [
      {
        label: "Établissement",
        href: "/admin/settings",
        icon: BuildingIcon,
      },
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
  "/admin/all-students": "Élève",
  "/admin/inscription-form": "Configuration du formulaire",
  "/admin/inscription-import": "Import inscriptions",
  "/admin/subjects": "Matières",
  "/admin/academic-years": "Années Scolaires",
  "/admin/settings": "Établissement",
  "/admin/archives": "Bulletins archivés",
  "/admin/journal": "Journal",
  "/admin/fin-annee/promotion": "Promotion des élèves",
  "/admin/fin-annee/configuration": "Reprendre une année",
};

function getBreadcrumbLabel(pathname: string): string {
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname];
  if (pathname.includes("/all-students")) return "Élève";
  if (pathname.includes("/inscription-form")) return "Configuration du formulaire";
  if (pathname.includes("/inscription-import")) return "Import inscriptions";
  if (pathname.includes("/students")) return "Élèves inscrits";
  if (pathname.includes("/subjects")) return "Matières";
  if (pathname.includes("/grades")) return "Notes";
  if (pathname.includes("/reports")) return "Bulletins";
  if (pathname.includes("/bulletins")) return "Bulletin";
  if (pathname.includes("/archives")) return "Archives";
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

  // Auth guard
  useEffect(() => {
    getMe().then((user) => {
      if (!user) {
        // `?expired=1` : sinon proxy.ts renverrait ici (le cookie mort est
        // toujours présent) → boucle /login ↔ /admin.
        window.location.href = "/login?expired=1";
      } else {
        setCurrentUser(user);
        setAuthLoading(false);
      }
    });
  }, []);

  // Année active
  useEffect(() => {
    fetchActiveAcademicYear()
      .then((year) => setActiveYear(year))
      .catch(() => setActiveYear(null))
      .finally(() => setYearLoading(false));
  }, []);

  // Pas de cloche de notifications : il n'existe aucune source de notifications
  // côté serveur. Les quatre entrées de démonstration qui vivaient ici — dont
  // un bulletin au nom d'une élève inventée — s'affichaient comme de vrais
  // événements horodatés, avec une pastille pulsante permanente. Rebrancher la
  // cloche demande un endpoint réel, pas un tableau littéral.

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Best-effort : même si l'appel échoue, on force la sortie locale.
    }

    window.location.href = "/login";
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

  const initials = `${currentUser?.firstname?.[0] ?? ""}${
    currentUser?.lastname?.[0] ?? ""
  }`;

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
      {/* Premier noeud focalisable de la coque. Sans lui, chaque changement de
          page imposait de retraverser une quinzaine d'elements avant d'atteindre
          le contenu — sur un produit ou l'administratrice saisit trente notes
          d'affilee au clavier. Invisible jusqu'au focus. */}
      <a
        href="#contenu-principal"
        className="sr-only z-50 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
      >
        Aller au contenu
      </a>
      {/* Sidebar */}
      {/* `offcanvas` et non `icon`, et surtout pas `none`.

          `icon` masquait les sous-menus : cliquer sur un groupe ne faisait rien,
          8 destinations sur 9 devenaient inatteignables, et l'etat etait
          persiste en cookie 7 jours.

          `none` a ete essaye et retire : la primitive rend alors un simple
          <div>, sans le conteneur `position: fixed` ni l'element qui reserve la
          largeur dans la mise en page — la barre defilait avec le contenu.

          `offcanvas`, le defaut de shadcn, garde la structure fixe et le tiroir
          mobile : replier fait sortir la barre entiere, et le declencheur la
          ramene. Rien d'a moitie cache. */}
      <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
        {/* Logo/Header */}
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
          >
            {/* Le sceau, pas une icone de bibliotheque. DESIGN.md le nomme
                Signature Component et designe cette barre comme le seul element
                porteur de l'identite — il n'etait appele que sur /login. Au
                passage le contraste de l'or passe de 2,88:1 sur l'ancien fond
                bleu a 6,90:1 sur `ardoise-profonde`, son seul fond tenable. */}
            <SchoolLogo size="sm" showText={false} />
            <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-serif text-base font-bold text-sidebar-foreground">
                CPMSL
              </span>
              <span className="truncate text-xs text-sidebar-foreground/70">
                Administration
              </span>
            </div>
          </Link>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent className="gap-0" role="navigation" aria-label="Navigation principale">
          <SidebarGroup className="px-0">
            <SidebarGroupLabel className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
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
                          // Le fond `sidebar-accent` seul mesure 1,27:1 sur la
                          // barre : invisible, la ou WCAG 1.4.11 exige 3:1. Le
                          // filet de gauche en `sidebar-foreground` donne
                          // 8,93:1 et porte l'etat a lui seul. Voir DESIGN.md,
                          // section amendee le 2026-09-16.
                          "border-l-2 border-transparent",
                          isActive &&
                            "border-l-sidebar-foreground bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                        )}
                      >
                        <Link href={item.href} aria-current={isActive ? "page" : undefined}>
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
                          <ChevronRightIcon className="ml-auto size-4 text-sidebar-foreground/60 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
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
                                    "transition-colors border-l-2 border-transparent",
                                    childActive &&
                                      "border-l-sidebar-foreground bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                                  )}
                                >
                                  <Link
                                    href={childHref}
                                    aria-current={childActive ? "page" : undefined}
                                    aria-disabled={childHref === "#" || undefined}
                                    title={
                                      childHref === "#"
                                        ? "Aucune année active — ouvrez Paramétrage › Années Scolaires"
                                        : undefined
                                    }
                                    className={cn(childHref === "#" && "cursor-not-allowed opacity-60")}
                                  >
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

        {/* Sidebar Footer */}
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
                      <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs font-semibold text-white">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold text-sidebar-foreground">
                        {currentUser?.firstname} {currentUser?.lastname}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/70">
                        Administrateur
                      </span>
                    </div>

                    <ChevronsUpDownIcon className="ml-auto size-4 text-sidebar-foreground/60" />
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
                    <UserIcon className="mr-2 h-4 w-4" />
                    Profil / Mon compte
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    <LockIcon className="mr-2 h-4 w-4" />
                    Changer mot de passe
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => router.push("/admin/settings")}
                  >
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Paramètres système
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="!text-destructive focus:!bg-destructive/10"
                  >
                    <LogOutIcon className="mr-2 h-4 w-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Main content area */}
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
                activeYear ? "bg-success" : "bg-muted-foreground",
              )}
            />
            {yearLoading ? "..." : activeYear?.name ?? "Aucune année"}
          </Badge>

          {/* User dropdown header */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-8 items-center gap-2 pl-2 pr-1"
              >
                <span className="hidden text-sm font-medium sm:inline">
                  {currentUser?.firstname}
                </span>

                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-3xs font-semibold">
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
                <UserIcon className="mr-2 h-4 w-4" />
                Profil
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                className="!text-destructive focus:!bg-destructive/10"
              >
                <LogOutIcon className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main id="contenu-principal" tabIndex={-1} className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 lg:pt-6">
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

    
    </SidebarProvider>
  );
}
