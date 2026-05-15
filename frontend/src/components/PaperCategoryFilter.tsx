/**
 * Compact arXiv category multi-select filter for Papers page.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Tag, X } from "lucide-react";
import type { ArxivCategory, ArxivTaxonomy, ArxivTaxonomyGroup } from "@/types";
import { topicApi } from "@/services/api";
import { cn } from "@/lib/utils";

interface PaperCategoryFilterProps {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export default function PaperCategoryFilter({
  value,
  onChange,
  className,
}: PaperCategoryFilterProps) {
  const [taxonomy, setTaxonomy] = useState<ArxivTaxonomy | null>(null);
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState<string>("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topicApi.getArxivCategories().then(setTaxonomy).catch(() => setTaxonomy(null));
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

  const selectedGroup: ArxivTaxonomyGroup | undefined = taxonomy?.groups.find(
    (g) => g.id === groupId
  );
  const categories: ArxivCategory[] = selectedGroup?.categories ?? [];

  const handleToggle = (cId: string) => {
    const next = new Set(value);
    if (next.has(cId)) next.delete(cId);
    else next.add(cId);
    onChange(Array.from(next));
  };

  const handleClear = () => {
    onChange([]);
  };

  const getLabel = (id: string) => {
    for (const g of taxonomy?.groups ?? []) {
      const cat = g.categories.find((c) => c.id === id);
      if (cat) return `${cat.id} - ${cat.name}`;
    }
    return id;
  };

  if (!taxonomy) return null;

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
        <Tag className="h-3 w-3 shrink-0" />
        <span>arXiv 分类</span>
        {value.length > 0 && (
          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium">
            {value.length}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-ink-tertiary">按 arXiv 分类筛选（可多选）</span>
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
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="mb-2 h-8 w-full rounded-lg border border-border bg-page px-2 text-[11px] text-ink"
          >
            <option value="">选择领域</option>
            {taxonomy.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {groupId && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-page p-2">
              <div className="grid grid-cols-1 gap-1">
                {categories.map((c) => {
                  const isSelected = value.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors hover:bg-hover",
                        isSelected ? "bg-primary/10 text-primary" : "text-ink-secondary",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(c.id)}
                        className="h-3 w-3 rounded border-border"
                      />
                      <span className="truncate">
                        {c.id} - {c.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {value.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {value.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                >
                  {getLabel(id)}
                  <button
                    type="button"
                    onClick={() => handleToggle(id)}
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
