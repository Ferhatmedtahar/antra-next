import { IconSearch, IconX } from "@tabler/icons-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  onClear?: () => void;
}

export function SearchInput({
  className,
  value,
  onChange,
  onClear,
  placeholder = "Filter…",
  ...props
}: SearchInputProps) {
  const hasValue = Boolean(value && String(value).length > 0);

  return (
    <div
      className={cn(
        "focus-ring-inset group relative flex h-11 w-full items-center gap-2.5 rounded-big bg-surface-soft px-2.5 transition-colors focus-within:bg-secondary-900/60 dark:focus-within:bg-primary-300",
        className,
      )}
    >
      <div className="rounded-icon bg-card text-muted-foreground group-focus-within:text-foreground flex size-8 shrink-0 items-center justify-center transition-colors">
        <IconSearch className="size-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="text-body-2-m placeholder:text-muted-foreground min-w-0 flex-1 border-none bg-transparent outline-none"
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear filter"
          className="rounded-icon hover:bg-card text-muted-foreground hover:text-foreground flex size-7 shrink-0 items-center justify-center transition-colors cursor-pointer"
        >
          <IconX className="size-3.5" />
        </button>
      )}
    </div>
  );
}
