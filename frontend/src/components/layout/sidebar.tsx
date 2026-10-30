"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/config/constants";
import { NAV_GROUPS, activeHref } from "@/config/nav";
import { cn } from "@/lib/utils";
import { BackendStatus } from "./backend-status";
import { BrandMark } from "./brand-mark";
import { ModeToggle } from "./mode-toggle";
import { ThemeToggle } from "./theme-toggle";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = activeHref(pathname);

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="group flex items-center gap-3 px-5 pb-5 pt-6">
        <BrandMark className="h-11 w-11 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
        <span>
          <span className="block text-base font-bold tracking-tight text-sidebar-text">{APP_NAME}</span>
          <span className="block text-xs text-sidebar-muted">Your personal coach</span>
        </span>
      </Link>
      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-xs font-medium text-sidebar-dim">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = current === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        active ? "btn-3d font-semibold text-white" : "text-sidebar-text hover:translate-x-0.5 hover:bg-sidebar-hover",
                      )}
                    >
                      <item.icon className={cn("h-[18px] w-[18px] transition-transform group-hover:scale-110", active ? "text-white" : "text-sidebar-muted")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-line bg-slate-50/50 px-5 py-4">
        <ModeToggle />
        <ThemeToggle />
        <BackendStatus />
      </div>
    </div>
  );
}
