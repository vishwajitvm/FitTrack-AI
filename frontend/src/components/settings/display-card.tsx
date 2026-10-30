"use client";

import type { ReactNode } from "react";
import { Eye, Monitor, Moon, Palette, Sun, Type, Wand2 } from "lucide-react";
import { usePrefs } from "@/components/layout/prefs-provider";
import { useTheme } from "@/components/layout/theme-provider";
import { openSetupWizard } from "@/components/onboarding/setup-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Pills } from "@/components/ui/touch";

function Row({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
        </div>
      </div>
      <div className="shrink-0 md:max-w-[60%]">{children}</div>
    </div>
  );
}

/** View mode, text size, theme and the setup wizard. */
export function DisplayCard() {
  const { mode, setMode, textSize, setTextSize } = usePrefs();
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader className="pb-4" title="Display" description="Saved on this device" icon={<Monitor className="h-4 w-4" />} />
      <div className="divide-y divide-line border-t border-line">
        <Row
          icon={<Eye className="h-4 w-4" />}
          title="How much detail?"
          hint={<>Simple hides technical terms (BMR, ACWR, p-values…) behind &ldquo;Show details&rdquo;. You can switch any time from the sidebar.</>}
        >
          <Pills
            options={[
              { value: "simple", label: "Simple — plain words" },
              { value: "detailed", label: "Detailed — every number" },
            ]}
            value={mode}
            onChange={setMode}
            ariaLabel="Detail level"
          />
        </Row>
        <Row icon={<Type className="h-4 w-4" />} title="Text size" hint="Large makes every page easier to read.">
          <Pills
            options={[
              { value: "normal", label: "Normal" },
              { value: "large", label: <span className="text-base">Large</span> },
            ]}
            value={textSize}
            onChange={setTextSize}
            ariaLabel="Text size"
          />
        </Row>
        <Row icon={<Palette className="h-4 w-4" />} title="Colours" hint="Light, dark, or follow your phone or computer.">
          <Pills
            options={[
              {
                value: "system",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Monitor className="h-4 w-4" /> Match my device
                  </span>
                ),
              },
              {
                value: "light",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Sun className="h-4 w-4" /> Light
                  </span>
                ),
              },
              {
                value: "dark",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Moon className="h-4 w-4" /> Dark
                  </span>
                ),
              },
            ]}
            value={theme}
            onChange={setTheme}
            ariaLabel="Theme"
          />
        </Row>
      </div>
      <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">About you, your goal, your day, protein powder and free AI — about 2 minutes.</p>
        <Button variant="outline" className="min-h-[44px]" onClick={openSetupWizard}>
          <Wand2 className="h-4 w-4" /> Run the setup guide again
        </Button>
      </CardFooter>
    </Card>
  );
}
