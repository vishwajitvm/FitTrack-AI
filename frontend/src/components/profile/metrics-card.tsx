import type { ReactNode } from "react";
import { Calculator } from "lucide-react";
import { InfoRow } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { WithTip } from "@/components/ui/info-tip";
import { Skeleton } from "@/components/ui/misc";
import { fmt, humanize } from "@/lib/format";
import type { ProfileMetrics } from "@/lib/types";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pt-3 first:pt-0">
      <p className="pb-1 text-xs font-medium text-slate-400">{title}</p>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

export function MetricsCard({ metrics }: { metrics: ProfileMetrics | undefined }) {
  return (
    <Card>
      <CardHeader title="Calculated metrics" description="Updates after you save" icon={<Calculator className="h-4 w-4" />} />
      <CardBody className="pt-4">
        {!metrics ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <Group title="Energy">
              <InfoRow
                label={<WithTip term="bmr">BMR</WithTip>}
                value={
                  metrics.bmr_status === "ok" ? (
                    `${fmt(metrics.bmr)} kcal`
                  ) : (
                    <Badge tone="warning">
                      <span className="h-1.5 w-1.5 rounded-full bg-warn-fg" aria-hidden />
                      Pending: {metrics.missing_fields.map(humanize).join(", ")}
                    </Badge>
                  )
                }
              />
              <InfoRow label={<WithTip term="tdee">Maintenance (TDEE est.)</WithTip>} value={metrics.tdee_estimate !== null ? `${fmt(metrics.tdee_estimate)} kcal` : "—"} />
              <InfoRow label="Maintenance range" value={metrics.maintenance_range ? `${fmt(metrics.maintenance_range.low)}–${fmt(metrics.maintenance_range.high)} kcal` : "—"} />
              <InfoRow label={<WithTip term="deficit">Suggested intake</WithTip>} value={metrics.calorie_target !== null ? `${fmt(metrics.calorie_target)} kcal` : "—"} />
              <InfoRow
                label={<WithTip term="protein_target">Protein target</WithTip>}
                value={metrics.protein_target_g ? `${fmt(metrics.protein_target_g.target)} g (${fmt(metrics.protein_target_g.min)}–${fmt(metrics.protein_target_g.max)})` : "—"}
              />
            </Group>
            <Group title="Body">
              <InfoRow label={<WithTip term="bmi">BMI</WithTip>} value={metrics.bmi !== null ? `${fmt(metrics.bmi, 1)} · ${metrics.bmi_category ?? ""}` : "—"} />
              <InfoRow label={<WithTip term="body_fat">Body fat (US Navy est.)</WithTip>} value={metrics.body_fat_estimate_pct !== null ? `${fmt(metrics.body_fat_estimate_pct, 1)}%` : <span className="text-slate-400">add waist & neck</span>} />
              <InfoRow label="Lean mass" value={metrics.lean_mass_kg !== null ? `${fmt(metrics.lean_mass_kg, 1)} kg` : "—"} />
              <InfoRow label={<WithTip term="water">Water target</WithTip>} value={metrics.water_target_ml !== null ? `${fmt(metrics.water_target_ml)} ml` : "—"} />
            </Group>
            <Group title="Progress">
              <InfoRow label="Weight change" value={metrics.weight_change_kg !== null ? `${fmt(metrics.weight_change_kg, 1)} kg` : "—"} />
              <InfoRow label="Days tracked" value={metrics.days_tracked ?? "—"} />
            </Group>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
