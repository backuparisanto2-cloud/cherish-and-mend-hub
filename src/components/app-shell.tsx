import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  Bot,
  Download,
  Inbox as InboxIcon,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { initialsOf, useAuth } from "@/lib/auth-context";
import assistantMark from "@/assets/purworejo-assistant-mark.png";

export const APP_NAV = [
  { label: "Inbox", icon: InboxIcon, to: "/" },
  { label: "Knowledge Base", icon: BookOpen, to: "/knowledge-base" },
  { label: "Menu Bot", icon: Bot, to: "/menu-bot" },
  { label: "Statistik", icon: BarChart3, to: "/statistik" },
  { label: "Export Data", icon: Download, to: "/export" },
  { label: "Pengaturan", icon: Settings, to: "/pengaturan" },
  { label: "Setup Chatera", icon: KeyRound, to: "/setup-chatera" },
] as const;


export function SidebarBrand() {
  return (
    <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-5">
        <img
          src={assistantMark}
          alt="Logo Purworejo chatbot Apps"
          width={42}
          height={42}
          className="size-10 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-sidebar-foreground">Purworejo</p>
          <p className="truncate text-xs text-muted-foreground">chatbot Apps</p>
      </div>
    </div>
  );
}

export function SidebarNav({
  onNavigate,
  badges,
}: {
  onNavigate?: () => void;
  badges?: Partial<Record<string, ReactNode>>;
}) {
  const { isOwner } = useAuth();
  const items = APP_NAV.filter((item) => item.label !== "Statistik" || isOwner);
  return (
    <nav aria-label="Navigasi utama" className="flex-1 space-y-1 px-3 py-5">
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase text-muted-foreground">Ruang kerja</p>
      {items.map(({ label, icon: Icon, to }) => (
        <Link
          key={label}
          to={to}
          onClick={onNavigate}
          className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeOptions={{ exact: true }}
          activeProps={{
            className:
              "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
          }}
        >
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
          {badges?.[label] ? <span className="ml-auto">{badges[label]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function SidebarStatus() {
  return (
    <div className="border-t border-sidebar-border p-4">
      <div className="flex items-center gap-2.5 rounded-md bg-sidebar-accent px-3 py-3">
        <ShieldCheck className="size-4 text-sidebar-primary" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-sidebar-foreground">Chatera terhubung</p>
          <p className="truncate text-[10px] text-muted-foreground">Webhook aktif</p>
        </div>
      </div>
    </div>
  );
}

/** Tombol hamburger + drawer sidebar untuk layar kecil. */
export function MobileNav({ badges }: { badges?: Partial<Record<string, ReactNode>> }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Buka menu navigasi">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-0">
        <SheetTitle className="sr-only">Navigasi utama</SheetTitle>
        <div className="flex h-full flex-col">
          <SidebarBrand />
          {badges ? <SidebarNav onNavigate={() => setOpen(false)} badges={badges} /> : <SidebarNav onNavigate={() => setOpen(false)} />}
          <SidebarStatus />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function HeaderUser() {
  const { user, signOut } = useAuth();
  const name = user?.full_name || user?.email || "Pengguna";
  return (
    <>
      <div className="hidden text-right sm:block">
        <p className="max-w-[160px] truncate text-xs font-semibold">{name}</p>
        <p className="text-[10px] capitalize text-muted-foreground">{user?.role ?? "—"}</p>
      </div>
      <Avatar className="size-9 border border-border">
        <AvatarFallback className="bg-accent text-xs font-bold text-accent-foreground">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <Button variant="ghost" size="icon" aria-label="Logout" onClick={() => void signOut()}>
        <LogOut />
      </Button>
    </>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh bg-app-canvas text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarBrand />
        <SidebarNav />
        <SidebarStatus />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="grid h-[76px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
              {subtitle ? (
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {actions}
            <HeaderUser />
          </div>
        </header>
        <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </main>
  );
}

export { cn };
