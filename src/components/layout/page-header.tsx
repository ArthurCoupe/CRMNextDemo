import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-5 -mt-16 flex flex-wrap items-center justify-between gap-3 border-b bg-background/85 px-5 pb-3.5 pt-16 backdrop-blur-md md:-mt-5 md:pt-5 lg:-mx-[22px] lg:px-[22px]">
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
