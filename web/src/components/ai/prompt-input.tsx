import type { FormEvent, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type PromptInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
};

export function PromptInput({ value, onChange, onSubmit, disabled, placeholder }: PromptInputProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!disabled && value.trim()) onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-eql-border bg-eql-panel/90 p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={placeholder ?? "Ask about classes, zones, news, builds…"}
          className={cn(
            "min-h-[44px] flex-1 resize-none rounded-xl border border-eql-border bg-eql-bg px-4 py-3 text-sm",
            "text-eql-text placeholder:text-eql-muted focus:border-eql-gold focus:outline-none"
          )}
        />
        <Button type="submit" disabled={disabled || !value.trim()} aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

export function PromptSuggestions({
  suggestions,
  onSelect,
  disabled
}: {
  suggestions: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 pb-4">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(suggestion)}
          className="rounded-full border border-eql-border bg-eql-panel px-3 py-1.5 text-xs text-eql-muted transition hover:border-eql-gold hover:text-eql-text disabled:opacity-50"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
