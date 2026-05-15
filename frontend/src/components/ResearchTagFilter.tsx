/**
 * Research tag multi-select filter for Papers page.
 * Uses LLM-classified tags: LLM, LLM Agent, Multi-Model LLM, etc.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Sparkles, X } from "lucide-react";
import { paperApi } from "@/services/api";
import { cn } from "@/lib/utils";

interface ResearchTagFilterProps {
  value: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

export default function ResearchTagFilter({
  value,
  onChange,
  className,
}: ResearchTagFilterProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    paperApi.researchTags().then((r) => setTags(r.tags)).catch(() => setTags([]));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const handleToggle = (tag: string) => {
    const next = new Set(value);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(Array.from(next));
  };

  const handleClear = () => {
    onChange([]);
  };

  if (!tags.length) return null;

  return (
    <div className={cn("relative", className)} ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[11px] transition-colors",
          value.length > 0 ? "border-primary/30 bg-primary/5 text-primary" : "text-ink-secondary hover:bg-hover hover:text-ink",
        )}
      >
        <Sparkles className="h-3 w-3 shrink-0" />
        <span>研究标签</span>
        {value.length > 0 && (
          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium">
            {value.length}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-ink-tertiary">按研究标签筛选（可多选）</span>
            {value.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 text-[10px] text-ink-tertiary hover:text-error"
              >
                <X className="h-3 w-3" /> 清空
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-page p-2">
            <div className="grid grid-cols-1 gap-1">
              {tags.map((tag) => {
                const isSelected = value.includes(tag);
                return (
                  <label
                    key={tag}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors hover:bg-hover",
                      isSelected ? "bg-primary/10 text-primary" : "text-ink-secondary",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(tag)}
                      className="h-3 w-3 rounded border-border"
                    />
                    <span className="truncate">{tag}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {value.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {value.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleToggle(tag)}
                    className="rounded-full p-0.5 hover:bg-primary/20"
                    aria-label="移除"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
