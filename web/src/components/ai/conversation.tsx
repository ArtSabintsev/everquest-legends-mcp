import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Conversation({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col", className)}>{children}</div>;
}

export function ConversationContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-4 py-6", className)}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">{children}</div>
    </div>
  );
}

export function Message({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2", role === "user" ? "items-end" : "items-start")}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-eql-muted">
        {role === "user" ? "You" : "EQL Guide"}
      </span>
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          role === "user"
            ? "bg-eql-accent/30 text-eql-text"
            : "border border-eql-border bg-eql-panel text-eql-text"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function MessageText({ text }: { text: string }) {
  return <div className="whitespace-pre-wrap">{text}</div>;
}
