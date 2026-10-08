import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ListItem, Metric } from "@/lib/schemas/screens";
import { cn } from "@/lib/utils";

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
      </div>
      {action}
    </header>
  );
}

function StatCards({ metrics }: { metrics: Metric[] }) {
  const tones = {
    blue: "bg-carely-info text-primary",
    sky: "bg-carely-sky-soft text-carely-sky",
    green: "bg-carely-success-soft text-carely-success",
    amber: "bg-[#fff6df] text-[#c47b00]",
    red: "bg-red-50 text-red-500",
  };
  const fallback: Array<keyof typeof tones> = ["blue", "sky", "green", "blue"];
  return (
    <div
      className={`mb-6 grid gap-3 ${
        metrics.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"
      }`}
    >
      {metrics.map((metric, index) => (
        <Card
          key={metric.label}
          className={`border-0 p-3 sm:p-4 ${tones[metric.tone ?? fallback[index % fallback.length]]}`}
        >
          <p className="text-muted-foreground text-xs sm:text-sm">{metric.label}</p>
          <p className="mt-1 text-xl font-bold sm:mt-2 sm:text-2xl">{metric.value}</p>
          {metric.note ? (
            <p className="text-muted-foreground mt-1 hidden text-xs sm:block">
              {metric.note}
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
  action,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Card className={`p-4 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function DataList({
  items,
  empty = "Nothing to show.",
  variant = "default",
}: {
  items: ListItem[];
  empty?: string;
  variant?: "default" | "action" | "surface";
}) {
  if (!items.length)
    return <div className="text-muted-foreground py-10 text-center text-sm">{empty}</div>;
  return (
    <div
      className={cn(
        variant === "default" && "divide-y",
        variant !== "default" && "space-y-3"
      )}
    >
      {items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className={cn(
            "flex gap-3",
            variant === "default"
              ? "flex-col py-4 sm:flex-row sm:items-center sm:justify-between"
              : "items-center",
            variant === "surface" && "bg-carely-surface rounded-lg p-3"
          )}
        >
          {variant !== "default" && item.meta ? (
            <span
              className={cn(
                "bg-secondary text-primary grid shrink-0 place-items-center rounded-lg font-bold",
                variant === "action" ? "size-10 text-xs" : "size-8 text-[9px]"
              )}
            >
              {item.meta}
            </span>
          ) : null}
          <div className={cn(variant !== "default" && "min-w-0 flex-1")}>
            <p
              className={cn(
                "font-semibold",
                variant === "action" && "text-sm sm:text-base",
                variant === "surface" && "text-xs"
              )}
            >
              {item.title}
            </p>
            {item.subtitle ? (
              <p
                className={cn(
                  "text-muted-foreground",
                  variant === "default" && "text-sm",
                  variant === "action" && "mt-1 text-xs leading-relaxed sm:text-sm",
                  variant === "surface" && "text-[10px]"
                )}
              >
                {item.subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {variant === "default" && item.meta ? (
              <span className="text-muted-foreground text-sm">{item.meta}</span>
            ) : null}
            {item.status ? (
              variant === "action" ? (
                item.href ? (
                  <Link
                    href={item.href}
                    className="bg-card inline-flex h-10 min-w-18 items-center justify-center rounded-md border px-3 text-xs font-semibold sm:text-sm"
                  >
                    {item.status}
                  </Link>
                ) : (
                  <span className="bg-card inline-flex h-10 min-w-18 items-center justify-center rounded-md border px-3 text-xs font-semibold sm:text-sm">
                    {item.status}
                  </span>
                )
              ) : (
                <Badge>{item.status}</Badge>
              )
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkTable({
  headers,
  rows,
  showHeader = true,
  variant = "default",
  highlightFirst = false,
}: {
  headers: string[];
  rows: string[][];
  showHeader?: boolean;
  variant?: "default" | "surface";
  highlightFirst?: boolean;
}) {
  if (!rows.length)
    return (
      <div className="text-muted-foreground py-10 text-center text-sm">
        Nothing to show.
      </div>
    );
  return (
    <>
      <div className={cn("sm:hidden", variant === "default" ? "divide-y" : "space-y-3")}>
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={cn(
              "grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-3 py-3 first:pt-0 last:pb-0",
              variant === "surface" && "bg-carely-surface rounded-lg px-3",
              highlightFirst && rowIndex === 0 && "bg-[#fff6df]"
            )}
          >
            <span className="text-muted-foreground text-xs">{row[0]}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row[1]}</p>
              {row[2] ? (
                <p className="text-muted-foreground mt-1 truncate text-xs">{row[2]}</p>
              ) : null}
              {variant === "surface" && row[3] ? (
                <p className="text-muted-foreground mt-1 text-xs">{row[3]}</p>
              ) : null}
            </div>
            {row[3] ? (
              <span className="text-primary text-xs font-semibold whitespace-nowrap">
                {variant === "surface" ? row.at(-1) : row[3]}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="hidden sm:block">
        <Table
          className={cn(variant === "surface" && "border-separate border-spacing-y-3")}
        >
          {showHeader ? (
            <TableHeader>
              <TableRow>
                {headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
          ) : null}
          <TableBody className={variant === "surface" ? "" : "divide-y"}>
            {rows.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={cn(
                  variant === "surface" && "bg-carely-surface",
                  highlightFirst && rowIndex === 0 && "bg-[#fff6df]"
                )}
              >
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={`${rowIndex}-${cellIndex}`}
                    className={cn(
                      cellIndex === 1 && "text-foreground font-semibold",
                      variant === "surface" &&
                        cellIndex === 0 &&
                        "text-primary rounded-l-lg font-bold",
                      variant === "surface" &&
                        cellIndex === row.length - 1 &&
                        "text-primary rounded-r-lg font-semibold",
                      variant === "surface" &&
                        cellIndex === 3 &&
                        (highlightFirst && rowIndex === 0
                          ? "font-medium text-[#c47b00]"
                          : "text-foreground")
                    )}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export { DataList, PageTitle, Panel, StatCards, WorkTable };
