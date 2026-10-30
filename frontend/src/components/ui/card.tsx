"use client";

import { Children, isValidElement, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import type { GlossaryKey } from "@/config/glossary";
import { ACCENT, type Accent } from "./accent";
import { cn } from "@/lib/utils";
import { CollapseBody, CollapseButton, CollapseContext, useCollapse, useCollapseState } from "./collapse";
import { InfoTip } from "./info-tip";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lifts slightly on hover (for cards you can click). */
  interactive?: boolean;
  /**
   * Collapse button. Default: on for every card whose first-level child is a CardHeader (remembered per page by its
   * title). A string turns it on with that storage id — for cards with their own header, which then place
   * <CollapseButton/> and wrap the hiding part in <CollapseBody/>. false turns it off.
   */
  collapsible?: boolean | string;
  defaultCollapsed?: boolean;
}

const isHeader = (c: ReactNode): c is ReactElement<CardHeaderProps> => isValidElement(c) && c.type === CardHeader;

export function Card({ className, interactive, collapsible, defaultCollapsed, children, ...props }: CardProps) {
  const items = Children.toArray(children);
  const headerAt = items.findIndex(isHeader);
  const header = headerAt >= 0 ? (items[headerAt] as ReactElement<CardHeaderProps>) : null;
  const enabled = collapsible === false ? false : typeof collapsible === "string" || collapsible === true || header !== null;
  const title = header && typeof header.props.title === "string" ? header.props.title : null;
  const id = typeof collapsible === "string" ? collapsible : title;
  const state = useCollapseState(enabled ? id : null, defaultCollapsed);

  const box = cn("glass rounded-3xl border", interactive && "lift cursor-pointer", enabled && state.collapsed && "self-start", className);
  if (!enabled) return <div className={box} {...props}>{children}</div>;
  return (
    <CollapseContext.Provider value={state}>
      <div className={box} data-collapsible="" {...props}>
        {header ? (
          <>
            {items.slice(0, headerAt + 1)}
            <CollapseBody>{items.slice(headerAt + 1)}</CollapseBody>
          </>
        ) : (
          children
        )}
      </div>
    </CollapseContext.Provider>
  );
}

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  /** Glossary key for a "?" next to the title. */
  info?: GlossaryKey;
  /** Metric colour for the icon bubble (default: brand). */
  accent?: Accent;
}

export function CardHeader({ title, description, icon, action, info, accent, className, ...props }: CardHeaderProps) {
  const c = useCollapse();
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", c?.collapsed && "pb-5", className)} {...props}>
      <div
        className={cn("flex min-w-0 items-center gap-3", c && "cursor-pointer select-none")}
        // the title area toggles too, except clicks on its own controls (the "?" tip)
        onClick={c ? (e) => !(e.target as HTMLElement).closest("button, a, input, select, label") && c.toggle() : undefined}
      >
        {icon && <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm", accent ? `${ACCENT[accent].tint} ${ACCENT[accent].text}` : "bg-hero text-white")}>{icon}</div>}
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-slate-900">
            {title}
            {info && <InfoTip term={info} />}
          </h3>
          {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
        </div>
      </div>
      {(action || c) && (
        <div className="flex shrink-0 items-center gap-2">
          {action && <div className={cn("flex items-center gap-2", c?.collapsed && "hidden sm:flex")}>{action}</div>}
          <CollapseButton label={typeof title === "string" ? title : "card"} />
        </div>
      )}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-end gap-2 rounded-b-3xl border-t border-line bg-slate-50/60 px-5 py-3", className)} {...props} />;
}
