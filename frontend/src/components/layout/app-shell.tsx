"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus, X } from "lucide-react";
import { APP_NAME } from "@/config/constants";
import { ALL_NAV, activeHref } from "@/config/nav";
import { CardsSkeleton } from "@/components/common/states";
import { Skeleton } from "@/components/ui/misc";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { SetupWizard } from "@/components/onboarding/setup-wizard";
import { QuickLog, openQuickLog } from "@/components/quick-log/quick-log";
import { BrandMark } from "./brand-mark";
import { SidebarContent } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

function DockLink({ item, active }: { item: (typeof ALL_NAV)[number]; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn("flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-colors", active ? "text-brand-600" : "text-slate-500")}
    >
      <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-all", active && "btn-3d text-white")}>
        <item.icon className="h-[18px] w-[18px]" />
      </span>
      <span className="max-w-full truncate px-0.5">{item.label}</span>
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-64 rounded-xl" />
      <CardsSkeleton />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const current = activeHref(pathname);
  const mobileItems = ALL_NAV.filter((i) => i.mobile);
  const mounted = useMounted();

  return (
    <div className="min-h-screen">
      {/* Soft aurora behind everything (fixed and still, so the glass stays cheap to draw). */}
      <div className="aurora" aria-hidden />

      {/* Desktop: a floating glass sidebar */}
      <aside className="glass fixed bottom-4 left-4 top-4 z-30 hidden w-64 overflow-hidden rounded-[28px] border xl:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between rounded-none border-0 border-b px-4 xl:hidden">
        <Link href="/" className="flex items-center gap-2.5 text-slate-900">
          <BrandMark className="h-8 w-8" />
          <span className="text-[15px] font-bold tracking-tight">{APP_NAME}</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button type="button" onClick={() => setDrawerOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="glass-strong fade-up absolute bottom-3 left-3 top-3 w-72 overflow-hidden rounded-[28px] border shadow-pop">
            <button type="button" onClick={() => setDrawerOpen(false)} className="absolute right-3 top-6 z-10 rounded-xl p-1.5 text-sidebar-muted hover:bg-sidebar-hover" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pt-8 xl:ml-[18rem] xl:pb-28">
        {/* Pages depend on the viewer's local date/time, so they render on the client only. */}
        <div className="mx-auto max-w-[1360px]">{mounted ? children : <PageSkeleton />}</div>
      </main>

      {mounted && <QuickLog />}
      {mounted && <SetupWizard />}

      {/* Phones and tablets: floating glass dock with the + Log button raised in the middle */}
      <nav className="glass fixed inset-x-3 bottom-3 z-30 mx-auto grid max-w-md grid-cols-5 items-end rounded-[26px] border px-1.5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 xl:hidden">
        {mobileItems.slice(0, 2).map((item) => (
          <DockLink key={item.href} item={item} active={current === item.href} />
        ))}
        <button type="button" onClick={() => openQuickLog()} className="group flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold text-slate-700" aria-label="Log something">
          <span className="bg-grad -mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-glow ring-4 ring-[rgb(var(--bg))] transition-transform active:scale-95">
            <Plus className="h-6 w-6 transition-transform group-hover:rotate-90" />
          </span>
          Log
        </button>
        {mobileItems.slice(2, 4).map((item) => (
          <DockLink key={item.href} item={item} active={current === item.href} />
        ))}
      </nav>
    </div>
  );
}
