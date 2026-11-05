import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className, claro = false }: { className?: string; claro?: boolean }) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-2 rounded-md", className)} aria-label="LibreLeitura — Catálogo">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-md",
          claro ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        <BookOpen className="size-4.5" aria-hidden="true" />
      </span>
      <span className={cn("text-lg tracking-tight", claro ? "text-sidebar-foreground" : "text-foreground")}>
        <span className="font-semibold">Libre</span>
        <span className="font-light">Leitura</span>
      </span>
    </Link>
  );
}
