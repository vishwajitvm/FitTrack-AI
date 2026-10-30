import {
  Activity,
  Bot,
  Brain,
  Camera,
  ClipboardList,
  Cpu,
  Dumbbell,
  FileHeart,
  History,
  HeartPulse,
  LayoutDashboard,
  MessageCircle,
  Settings,
  User,
  Utensils,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  mobile?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Track",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, mobile: true },
      { href: "/ask", label: "Ask FitTrack", icon: MessageCircle },
      { href: "/food/scan", label: "Snap a meal", icon: Camera, mobile: true },
      { href: "/food", label: "Food log", icon: Utensils, mobile: true },
      { href: "/workouts", label: "Workouts", icon: Dumbbell, mobile: true },
      { href: "/history", label: "History", icon: History },
      { href: "/tracker", label: "Daily tracker", icon: ClipboardList },
      { href: "/insights", label: "Insights (ML)", icon: Brain },
      { href: "/checkin", label: "Check-in & gut health", icon: HeartPulse },
      { href: "/medical", label: "Medical reports", icon: FileHeart },
    ],
  },
  {
    title: "Configure",
    items: [
      { href: "/profile", label: "Profile", icon: User },
      { href: "/ai", label: "AI providers & keys", icon: Bot },
      { href: "/ollama", label: "Ollama (local AI)", icon: Cpu },
      { href: "/settings", label: "Settings & data", icon: Settings },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const BRAND_ICON = Activity;

/** Longest-prefix match so `/food/scan` doesn't also light up `/food`. */
export function activeHref(pathname: string): string {
  let best = "/";
  for (const item of ALL_NAV) {
    if (item.href === "/") continue;
    if ((pathname === item.href || pathname.startsWith(`${item.href}/`)) && item.href.length > best.length) best = item.href;
  }
  return pathname === "/" ? "/" : best;
}
