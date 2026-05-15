/**
 * Two-level arXiv category selector (Group -> Category) with multi-select.
 */
import { useEffect, useState } from "react";
import type { ArxivCategory, ArxivTaxonomy, ArxivTaxonomyGroup } from "@/types";
import { topicApi } from "@/services/api";

interface CategorySelectorProps {
  value: string[];
  onChange: (categoryIds: string[], categoryNames: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CategorySelector({
  value,
  onChange,
  placeholder = "选择分类",
  disabled = false,
}: CategorySelectorProps) {
  const [taxonomy, setTaxonomy] = useState<ArxivTaxonomy | null>(null);
  const [groupId, setGroupId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(value));

  useEffect(() => {
    topicApi.getArxivCategories().then(setTaxonomy).catch(() => setTaxonomy(null));
  }, []);

  useEffect(() => {
    setSelectedIds(new Set(value));
  }, [value]);

  useEffect(() => {
    if (value.length > 0 && taxonomy) {
      const g = taxonomy.groups.find((x) =>
        x.categories.some((c) => value.includes(c.id))
      );
      if (g) setGroupId(g.id);
    }
  }, [value, taxonomy]);

  const selectedGroup: ArxivTaxonomyGroup | undefined = taxonomy?.groups.find(
    (g) => g.id === groupId
  );
  const categories: ArxivCategory[] = selectedGroup?.categories ?? [];

  const handleGroupChange = (gId: string) => {
    setGroupId(gId);
  };

  const handleCategoryToggle = (cId: string, cName: string) => {
    const next = new Set(selectedIds);
    if (next.has(cId)) {
      next.delete(cId);
    } else {
      next.add(cId);
    }
    setSelectedIds(next);
    const ids = Array.from(next);
    const names = ids
      .map((id) => {
        for (const g of taxonomy?.groups ?? []) {
          const cat = g.categories.find((c) => c.id === id);
          if (cat) return cat.name;
        }
        return id;
      })
      .filter(Boolean);
    onChange(ids, names);
  };

  const handleRemove = (cId: string) => {
    const next = new Set(selectedIds);
    next.delete(cId);
    setSelectedIds(next);
    const ids = Array.from(next);
    const names = ids
      .map((id) => {
        for (const g of taxonomy?.groups ?? []) {
          const cat = g.categories.find((c) => c.id === id);
          if (cat) return cat.name;
        }
        return id;
      })
      .filter(Boolean);
    onChange(ids, names);
  };

  if (!taxonomy) {
    return (
      <select disabled className="form-input">
        <option>加载分类中...</option>
      </select>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={groupId}
          onChange={(e) => handleGroupChange(e.target.value)}
          disabled={disabled}
          className="form-input flex-1"
        >
          <option value="">{placeholder} - 选择领域</option>
          {taxonomy.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      {groupId && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface p-2">
          <p className="mb-2 text-[10px] text-ink-tertiary">
            可多选，点击添加/取消
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {categories.map((c) => {
              const isSelected = selectedIds.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-hover ${
                    isSelected ? "bg-primary/10 text-primary" : "text-ink-secondary"
                  } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleCategoryToggle(c.id, c.name)}
                    disabled={disabled}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <span>
                    {c.id} - {c.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from(selectedIds).map((id) => {
            let label = id;
            for (const g of taxonomy.groups) {
              const cat = g.categories.find((c) => c.id === id);
              if (cat) {
                label = `${cat.id} - ${cat.name}`;
                break;
              }
            }
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {label}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(id)}
                    className="rounded-full p-0.5 hover:bg-primary/20"
                    aria-label="移除"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
