import Link from "next/link";
import { Camera, Dumbbell, HeartPulse, MessageCircle, UserRoundPen, Zap } from "lucide-react";
import { ScoopButton } from "@/components/food/scoop-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ACCENT, type Accent } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

const actions: { href: string; label: string; sub: string; icon: typeof Camera; accent: Accent }[] = [
  { href: "/food/scan", label: "Snap a meal", sub: "Photo → calories", icon: Camera, accent: "kcal" },
  { href: "/workouts", label: "Log workout", sub: "Your routine in taps", icon: Dumbbell, accent: "burn" },
  { href: "/checkin", label: "Check in", sub: "Sleep, energy, mood", icon: HeartPulse, accent: "sleep" },
  { href: "/ask", label: "Ask FitTrack", sub: "Questions about you", icon: MessageCircle, accent: "balance" },
];

/** The four things people do most, as big friendly tiles, plus the one-tap protein scoop. */
export function QuickActions() {
  return (
    <Card>
      <CardHeader title="Quick actions" description="The things you log most" icon={<Zap className="h-4 w-4" />} />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a, i) => {
            const c = ACCENT[a.accent];
            return (
              <Link
                key={a.href}
                href={a.href}
                style={{ animationDelay: `${i * 50}ms` }}
                className="fade-up lift group flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110", c.tint, c.text)}>
                  <a.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{a.label}</span>
                  <span className="block text-xs text-slate-500">{a.sub}</span>
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <ScoopButton />
          <span className="text-xs text-slate-500">One tap logs your protein powder</span>
        </div>
      </CardBody>
    </Card>
  );
}

export function BiometricsBanner({ missing }: { missing: string[] }) {
  if (!missing.length) return null;
  return (
    <div className="fade-up flex flex-col gap-4 rounded-2xl border border-warn-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warn-bg text-warn-fg">
          <UserRoundPen className="h-5 w-5" />
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            Add your {missing.join(" and ")} for accurate numbers <InfoTip term="pending_biometrics" />
          </p>
          <p className="mt-0.5 text-[13px] text-slate-500">Until then your burn (BMR) and deficit show as &ldquo;Pending Biometric Confirmation&rdquo;.</p>
        </div>
      </div>
      <Link href="/profile" className="inline-flex min-h-[40px] items-center justify-center gap-2 self-start rounded-xl bg-navy px-4 text-sm font-medium text-white shadow-sm hover:bg-navy-800 sm:self-auto">
        Update profile
      </Link>
    </div>
  );
}
