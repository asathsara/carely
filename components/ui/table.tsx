import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}
function TableHeader(props: ComponentProps<"thead">) {
  return <thead className="bg-carely-surface text-foreground" {...props} />;
}
function TableBody(props: ComponentProps<"tbody">) {
  return <tbody className="divide-y" {...props} />;
}
function TableRow(props: ComponentProps<"tr">) {
  return <tr className="hover:bg-carely-surface transition-colors" {...props} />;
}
function TableHead({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("px-4 py-3 font-semibold", className)} {...props} />;
}
function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("text-muted-foreground px-4 py-3", className)} {...props} />;
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
