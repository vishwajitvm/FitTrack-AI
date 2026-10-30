"use client";

import type { ReactNode } from "react";
import { CollapseBody, CollapseButton, Collapsible } from "@/components/ui/collapse";
import { cn } from "@/lib/utils";

interface Props {
  /** Storage id (remembered per page). */
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Controls beside the title (hidden on phones while collapsed). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Gap between the heading and the content. */
  bodyClassName?: string;
  as?: "h2" | "h3";
}

/** A titled group of cards on a page ("Day log", "Meals"…) with a collapse/expand button. */
export function CollapsibleSection({ id, title, description, actions, children, className, bodyClassName = "pt-4", as: H = "h2" }: Props) {
  const label = typeof title === "string" ? title : "section";
  return (
    <Collapsible id={`section.${id}`}>
      {(c) => (
        <section className={className} data-collapsible="">
          <div className="flex flex-wrap items-end gap-3 px-1">
            {/* on phones the chevron sits beside the title and the actions wrap below */}
            <div className="flex min-w-0 flex-1 basis-64 items-start gap-2">
              <div className="min-w-0 flex-1 cursor-pointer select-none" onClick={(e) => !(e.target as HTMLElement).closest("button, a") && c.toggle()}>
                <H className="text-lg font-semibold tracking-tight text-slate-900">{title}</H>
                {description && <div className="mt-0.5 text-[13px] text-slate-500">{description}</div>}
              </div>
              <CollapseButton label={label} className="glass sm:hidden" />
            </div>
            {actions && <div className={cn("flex flex-wrap items-center gap-2", c.collapsed && "hidden sm:flex")}>{actions}</div>}
            <CollapseButton label={label} className="glass hidden sm:flex" />
          </div>
          <CollapseBody>
            <div className={bodyClassName}>{children}</div>
          </CollapseBody>
        </section>
      )}
    </Collapsible>
  );
}
