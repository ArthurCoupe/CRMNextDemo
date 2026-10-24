import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageSectionProps {
  title: string;
  lede?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageSection({ title, lede, actions, children, className }: PageSectionProps) {
  return (
    <section className={cn("mb-6", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[14.5px] font-bold tracking-tight">{title}</h2>
          {lede !== undefined && (
            <p className="mt-0.5 max-w-[74ch] text-xs text-muted-foreground">{lede}</p>
          )}
        </div>
        {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
