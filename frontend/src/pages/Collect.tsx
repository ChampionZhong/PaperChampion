/**
 * 论文收集与订阅管理（重构版：手动抓取 + 丰富结果展示）
 * @author Bamzc
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Empty, Spinner } from "@/components/ui";
import {
  Search,
  Download,
  Globe,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Power,
  PowerOff,
  Sparkles,
  Pencil,
  X,
  Rss,
  Loader2,
  RefreshCw,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Library,
  Calendar,
  Hash,
  Zap,
  Play,
} from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { ingestApi, topicApi, type TopicFetchResult } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";
import ConfirmDialog from "@/components/ConfirmDialog";
import CategorySelector from "@/components/CategorySelector";
import type { Topic, TopicCreate, TopicUpdate, ScheduleFrequency, FetchMode, KeywordSuggestion, TopicRunSummary, TopicRunDetail, TopicRunPaper } from "@/types";

type SortBy = "submittedDate" | "relevance" | "lastUpdatedDate";

interface SearchResultPaper {
  arxiv_id: string;
  title: string;
  abstract?: string;
  publication_date?: string | null;
  metadata?: Record<string, unknown>;
  already_ingested?: boolean;
  paper_id?: string;
}

interface SearchResult {
  papers: SearchResultPaper[];
  query: string;
  sortBy: SortBy;
  time: string;
  expanded: boolean;
  selectedIds: Set<string>;
}

const FREQ_OPTIONS: { value: ScheduleFrequency; label: string; desc: string }[] = [
  { value: "daily", label: "每天", desc: "每日自动抓取" },
  { value: "twice_daily", label: "每天两次", desc: "所选时间 + 12 小时后各一次" },
  { value: "weekdays", label: "工作日", desc: "周一至周五" },
  { value: "weekly", label: "每周", desc: "每周日" },
];
const FREQ_LABEL: Record<string, string> = { daily: "每天", twice_daily: "每天两次", weekdays: "工作日", weekly: "每周" };

function utcToBj(utc: number): number { return (utc + 8) % 24; }
function bjToUtc(bj: number): number { return (bj - 8 + 24) % 24; }

/** Build arXiv keyword query from raw input (plain text -> all:foo AND all:bar) */
function buildKeywordQuery(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/\b(all|ti|au|abs|cat|co|jr|rn|id):/i.test(s)) return s;
  const tokens = s.split(/\s+/).filter((t) => t.length >= 2).slice(0, 3);
  if (tokens.length === 0) return `all:${s}`;
  return tokens.map((t) => `all:${t}`).join(" AND ");
}
function hourOptions(): { value: number; label: string }[] {
  return Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${String(i).padStart(2, "0")}:00` }));
}

export default function Collect() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // ========== 即时搜索 ==========
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [sortBy, setSortBy] = useState<SortBy>("submittedDate");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState("");

  // ========== 订阅管理 ==========
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingTopicId, setFetchingTopicId] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState<Record<string, { progress_pct: number; message: string }>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ========== 论文订阅表单（统一：分类 + 关键词，至少填一项） ==========
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formQuery, setFormQuery] = useState("");
  const [formMax, setFormMax] = useState(20);
  const [formFreq, setFormFreq] = useState<ScheduleFrequency>("daily");
  const [formTimeBj, setFormTimeBj] = useState(5);
  const [saving, setSaving] = useState(false);

  // ========== AI 建议 ==========
  const [aiDesc, setAiDesc] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ========== 分类订阅字段（有分类时使用） ==========
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([]);
  const [formCategoryMax, setFormCategoryMax] = useState(20);
  const [formCategoryFetchMode, setFormCategoryFetchMode] = useState<FetchMode>("quantity");
  const [formCategoryDateDays, setFormCategoryDateDays] = useState(7);
  const [formCategoryFreq, setFormCategoryFreq] = useState<ScheduleFrequency>("daily");
  const [formCategoryTimeBj, setFormCategoryTimeBj] = useState(5);
  const [runHistoryTopicId, setRunHistoryTopicId] = useState<string | null>(null);

  useEffect(() => {
    topicApi.list(false).then((r) => { setTopics(r.items); setLoading(false); }).catch(() => setLoading(false));
  }, []);


  // ========== 即时搜索 ==========
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true); setError("");
    try {
      const res = await ingestApi.searchArxiv(query.trim(), maxResults, sortBy);
      setResults((prev) => [{
        papers: res.papers || [],
        query: res.query || query.trim(),
        sortBy,
        time: new Date().toLocaleTimeString("zh-CN"),
        expanded: true,
        selectedIds: new Set<string>(),
      }, ...prev.map(r => ({ ...r, expanded: false }))]);
      const count = (res.papers || []).length;
      if (count > 0) toast("info", `找到 ${count} 篇论文，勾选后点击入库`);
      else toast("info", "未找到论文");
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    } finally { setSearching(false); }
  }, [query, maxResults, sortBy, toast]);

  // ========== 手动抓取订阅 ==========
  const handleManualFetch = useCallback(async (topicId: string) => {
    setFetchingTopicId(topicId);
    try {
      const res: TopicFetchResult = await topicApi.fetch(topicId);
      if (res.status === "started" || res.status === "already_running") {
        toast("info", res.topic_name || "抓取已在后台启动...");
        // 轮询状态
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const status = await topicApi.fetchStatus(topicId);
            if (status.status === "running") {
              setFetchProgress((p) => ({
                ...p,
                [topicId]: {
                  progress_pct: (status as { progress_pct?: number }).progress_pct ?? 0,
                  message: (status as { message?: string }).message ?? "抓取中...",
                },
              }));
              return;
            }
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            setFetchingTopicId(null);
            setFetchProgress((p) => {
              const next = { ...p };
              delete next[topicId];
              return next;
            });
            const isSuccess = status.status === "ok" || status.status === "completed" || status.status === "no_new_papers";
            if (isSuccess) {
              const runId = (status as { run_id?: string }).run_id;
              const paperCount = (status as { paper_count?: number }).paper_count ?? status.inserted ?? 0;
              if (runId) {
                toast("success", `抓取完成，${paperCount} 篇论文已保存至运行历史，可手动勾选入库`);
                setRunHistoryTopicId(topicId);
              } else {
                const newCount = status.inserted ?? 0;
                const processed = status.processed ?? 0;
                let msg = `抓取完成：${newCount} 篇新论文`;
                if (processed > 0) msg += `，${processed} 篇处理`;
                toast("success", msg);
              }
              const list = await topicApi.list(false);
              setTopics(list.items);
              return;
            }
            if (status.status === "failed") {
              toast("error", `抓取失败：${status.error || "未知错误"}`);
            }
            // 无论如何都刷新列表
            const list = await topicApi.list(false);
            setTopics(list.items);
          } catch {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            setFetchingTopicId(null);
            setFetchProgress((p) => {
              const next = { ...p };
              delete next[topicId];
              return next;
            });
          }
        }, 3000);
        return;
      }
      if (res.status === "ok") {
        const newCount = res.inserted;
        const processed = res.processed ?? 0;
        let msg = `抓取完成：${newCount} 篇新论文`;
        if (processed > 0) msg += `，${processed} 篇处理`;
        toast("success", msg);
        const list = await topicApi.list(false);
        setTopics(list.items);
      } else if (res.status === "no_new_papers") {
        toast("info", `⚠️  没有新论文，已跳过处理`);
      } else {
        toast("error", `抓取失败：${res.error || "未知错误"}`);
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "抓取失败");
    } finally { setFetchingTopicId(null); }
  }, [toast]);

  // ========== AI 建议 ==========
  const handleAiSuggest = useCallback(async () => {
    const desc = aiDesc.trim() || formQuery.trim() || query.trim();
    if (!desc) return;
    setAiLoading(true); setSuggestions([]);
    try { const res = await topicApi.suggestKeywords(desc); setSuggestions(res.suggestions); }
    catch { setError("AI 建议失败"); } finally { setAiLoading(false); }
  }, [aiDesc, formQuery, query]);

  const applySuggestion = useCallback((s: KeywordSuggestion) => {
    setFormName(s.name);
    setFormQuery(s.query);
    setSuggestions([]);
    setAiDesc("");
  }, []);

  // ========== 表单操作 ==========
  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditId(null);
    setFormName("");
    setFormQuery("");
    setFormMax(20);
    setFormFreq("daily");
    setFormTimeBj(5);
    setFormCategoryIds([]);
    setFormCategoryMax(20);
    setFormCategoryFetchMode("quantity");
    setFormCategoryDateDays(7);
    setFormCategoryFreq("daily");
    setFormCategoryTimeBj(5);
    setSuggestions([]);
    setAiDesc("");
  }, []);
  const openAdd = useCallback(() => { resetForm(); setShowForm(true); }, [resetForm]);
  const openEdit = useCallback((t: Topic) => {
    setEditId(t.id);
    setFormName(t.name);
    const hasCategory = !!(t.category_id || t.category_ids);
    const ids = hasCategory ? (t.category_ids ? t.category_ids.split(",").map((x) => x.trim()).filter(Boolean) : t.category_id ? [t.category_id] : []) : [];
    setFormCategoryIds(ids);
    setFormCategoryMax(t.max_results_per_run);
    setFormCategoryFetchMode((t.fetch_mode as FetchMode) || "quantity");
    setFormCategoryDateDays(t.date_filter_days ?? 7);
    setFormCategoryFreq(t.schedule_frequency || "daily");
    setFormCategoryTimeBj(utcToBj(t.schedule_time_utc ?? 21));
    setFormMax(t.max_results_per_run);
    setFormFreq(t.schedule_frequency || "daily");
    setFormTimeBj(utcToBj(t.schedule_time_utc ?? 21));
    setSuggestions([]);
    setAiDesc("");
    if (hasCategory && t.query && t.query.includes(") AND (")) {
      const match = t.query.match(/^\(([^)]*)\) AND \(([^)]*)\)$/);
      if (match) setFormQuery(match[2]);
      else setFormQuery("");
    } else if (hasCategory) {
      setFormQuery("");
    } else {
      setFormQuery(t.query);
    }
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    const hasCategory = formCategoryIds.length > 0;
    const hasKeyword = formQuery.trim().length > 0;
    if (!hasCategory && !hasKeyword) return;
    if (!formName.trim()) return;

    setSaving(true);
    try {
      const catPart = hasCategory
        ? (formCategoryIds.length === 1 ? `cat:${formCategoryIds[0]}` : formCategoryIds.map((id) => `cat:${id}`).join(" OR "))
        : "";
      const kwPart = hasKeyword ? buildKeywordQuery(formQuery.trim()) : "";
      const query = hasCategory && hasKeyword
        ? `(${catPart}) AND (${kwPart})`
        : catPart || kwPart;

      const hasCategoryFlow = hasCategory;
      const utcHour = hasCategoryFlow ? bjToUtc(formCategoryTimeBj) : bjToUtc(formTimeBj);
      const maxResults = hasCategoryFlow ? formCategoryMax : formMax;
      const freq = hasCategoryFlow ? formCategoryFreq : formFreq;

      const basePayload = {
        name: formName.trim(),
        query,
        enabled: true,
        max_results_per_run: maxResults,
        schedule_frequency: freq,
        schedule_time_utc: utcHour,
      };

      if (hasCategoryFlow) {
        const payload = {
          ...basePayload,
          category_ids: formCategoryIds.join(","),
          fetch_mode: formCategoryFetchMode,
          date_filter_days: formCategoryFetchMode === "date" ? formCategoryDateDays : 7,
          date_range_start: null,
          date_range_end: null,
        };
        if (editId) {
          const updated = await topicApi.update(editId, payload);
          setTopics((prev) => prev.map((x) => (x.id === editId ? updated : x)));
        } else {
          const topic = await topicApi.create(payload);
          setTopics((prev) => [topic, ...prev]);
        }
      } else {
        const payload = { ...basePayload, category_ids: "" };
        if (editId) {
          const updated = await topicApi.update(editId, payload);
          setTopics((prev) => prev.map((x) => (x.id === editId ? updated : x)));
        } else {
          const topic = await topicApi.create(payload);
          setTopics((prev) => [topic, ...prev]);
        }
      }
      resetForm();
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败"); } finally { setSaving(false); }
  }, [formName, formQuery, formMax, formFreq, formTimeBj, formCategoryIds, formCategoryMax, formCategoryFetchMode, formCategoryDateDays, formCategoryFreq, formCategoryTimeBj, editId, resetForm]);

  const handleToggle = useCallback(async (t: Topic) => {
    try {
      const updated = await topicApi.update(t.id, { enabled: !t.enabled });
      setTopics((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch { toast("error", "切换订阅状态失败"); }
  }, [toast]);
  const handleDelete = useCallback(async (id: string) => {
    try { await topicApi.delete(id); setTopics((prev) => prev.filter((t) => t.id !== id)); } catch { toast("error", "删除订阅失败"); }
  }, []);


  return (
    <div className="animate-fade-in space-y-6">
      {/* 页面头 */}
      <div className="page-hero rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><Search className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-ink">论文收集</h1>
            <p className="mt-0.5 text-sm text-ink-secondary">搜索下载论文 · 创建订阅自动收集 · 随时手动触发抓取</p>
          </div>
        </div>
      </div>

      {/* 错误 */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error-light px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-error" />
          <p className="flex-1 text-sm text-error">{error}</p>
          <button aria-label="关闭" onClick={() => setError("")} className="text-error/60 hover:text-error"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ================================================================
       * 即时搜索区
       * ================================================================ */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-xl bg-primary/8 p-2"><Globe className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-ink">即时搜索</h2>
            <p className="text-xs text-ink-tertiary">输入关键词从 arXiv 搜索，勾选论文后手动入库</p>
          </div>
        </div>

        {/* 搜索栏 */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="LLM Agent, RL, Reasoning..."
              className="h-11 w-full rounded-xl border border-border bg-page pl-10 pr-4 text-sm text-ink placeholder:text-ink-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button icon={searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} onClick={handleSearch} loading={searching} disabled={!query.trim()}>
            搜索
          </Button>
        </div>

        {/* 筛选条件 */}
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-ink-secondary">
            <Hash className="h-3 w-3" /> 数量
            <select value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} className="h-7 rounded-lg border border-border bg-surface px-2 text-xs text-ink">
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-secondary">
            <ArrowUpDown className="h-3 w-3" /> 排序
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="h-7 rounded-lg border border-border bg-surface px-2 text-xs text-ink">
              <option value="submittedDate">最新提交</option>
              <option value="relevance">相关性</option>
              <option value="lastUpdatedDate">最近更新</option>
            </select>
          </label>
          {query.trim() && (
            <button
              onClick={() => { setFormName(query.trim()); setFormQuery(query.trim()); setFormMax(maxResults); setShowForm(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <Clock className="h-3 w-3" /> 存为论文订阅
            </button>
          )}
        </div>

        {/* 搜索结果 */}
        {results.length > 0 && (
          <div className="mt-5 space-y-3">
            {results.map((r, i) => (
              <SearchResultCard
                key={i}
                result={r}
                onToggle={() => setResults((prev) => prev.map((x, j) => (j === i ? { ...x, expanded: !x.expanded } : { ...x, expanded: false })))}
                onTogglePaper={(arxivId, alreadyIngested) => {
                  if (alreadyIngested) return;
                  setResults((prev) => prev.map((x, j) => {
                    if (j !== i) return x;
                    const next = new Set(x.selectedIds);
                    if (next.has(arxivId)) next.delete(arxivId);
                    else next.add(arxivId);
                    return { ...x, selectedIds: next };
                  }));
                }}
                onSelectAll={() => setResults((prev) => prev.map((x, j) => {
                  if (j !== i) return x;
                  const selectable = x.papers.filter((p) => !p.already_ingested);
                  return { ...x, selectedIds: new Set(selectable.map((p) => p.arxiv_id)) };
                }))}
                onIngest={async () => {
                  const r = results[i];
                  if (!r || r.selectedIds.size === 0) return;
                  try {
                    const res = await ingestApi.ingestSelected(Array.from(r.selectedIds));
                    toast("success", `成功入库 ${res.ingested} 篇论文`);
                    const idMap = new Map((res.papers || []).map((p) => [p.arxiv_id, p.id]));
                    setResults((prev) =>
                      prev.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              selectedIds: new Set<string>(),
                              papers: x.papers.map((p) => ({
                                ...p,
                                already_ingested: p.already_ingested || r.selectedIds.has(p.arxiv_id),
                                paper_id: idMap.get(p.arxiv_id) ?? p.paper_id,
                              })),
                            }
                          : x
                      )
                    );
                  } catch {
                    toast("error", "入库失败");
                  }
                }}
                onNavigate={(paperId) => navigate(`/papers/${paperId}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ================================================================
       * 论文订阅（分类 + 关键词）
       * ================================================================ */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-primary/8 p-2"><Rss className="h-4 w-4 text-primary" /></div>
            <div>
              <h2 className="text-sm font-semibold text-ink">论文订阅</h2>
              <p className="text-xs text-ink-tertiary">按 arXiv 分类或关键词订阅，定时或手动抓取最新论文</p>
            </div>
          </div>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>新建订阅</Button>
        </div>

        {/* 新建表单：顶部展示 */}
        {showForm && !editId && (
          <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                {editId ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
                {editId ? "编辑订阅" : "新建订阅"}
              </h3>
              <button aria-label="关闭" onClick={resetForm} className="rounded-lg p-1 text-ink-tertiary hover:bg-hover"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <FormField label="订阅名称" hint="给这个订阅起个名字">
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例：Machine Learning 或 LLM Agent"
                  className="form-input"
                />
              </FormField>

              <FormField label="arXiv 分类" hint="选择领域和具体分类，可多选；与关键词二选一或同时使用">
                <CategorySelector
                  value={formCategoryIds}
                  onChange={(ids) => setFormCategoryIds(ids)}
                  disabled={!!editId}
                />
              </FormField>

              <FormField label="搜索关键词" hint="arXiv API 搜索表达式；二者至少填一项，可同时使用">
                <input value={formQuery} onChange={(e) => setFormQuery(e.target.value)} placeholder="all:NeRF AND all:3D 或直接输入关键词" className="form-input" />
              </FormField>

              <div className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.02] p-4">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> AI 关键词助手
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input value={aiDesc} onChange={(e) => setAiDesc(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAiSuggest(); }}
                      placeholder="用自然语言描述你的研究兴趣，AI 自动生成搜索词..."
                      className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-ink placeholder:text-ink-placeholder focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20" />
                  </div>
                  <Button variant="secondary" size="sm" icon={aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    onClick={handleAiSuggest} disabled={aiLoading || (!aiDesc.trim() && !formQuery.trim() && !query.trim())}>
                    生成
                  </Button>
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => applySuggestion(s)}
                        className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-left transition-all hover:border-primary/30 hover:shadow-sm">
                        <Zap className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink">{s.name}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-primary/70">{s.query}</p>
                          <p className="mt-0.5 text-[10px] text-ink-tertiary">{s.reason}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {formCategoryIds.length > 0 && (
                <>
                  <FormField label="抓取模式" hint="数量模式按篇数；日期模式按论文更新时间">
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="fetchMode"
                            checked={formCategoryFetchMode === "quantity"}
                            onChange={() => setFormCategoryFetchMode("quantity")}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs">数量</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="fetchMode"
                            checked={formCategoryFetchMode === "date"}
                            onChange={() => setFormCategoryFetchMode("date")}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs">日期</span>
                        </label>
                      </div>
                      {formCategoryFetchMode === "quantity" ? (
                        <select value={formCategoryMax} onChange={(e) => setFormCategoryMax(Number(e.target.value))} className="form-input">
                          {[10, 20, 50].map((n) => <option key={n} value={n}>{n} 篇</option>)}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-secondary">最近</span>
                          <select value={formCategoryDateDays} onChange={(e) => setFormCategoryDateDays(Number(e.target.value))} className="form-input">
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} 天</option>)}
                          </select>
                          <span className="text-xs text-ink-tertiary">（按论文更新时间）</span>
                        </div>
                      )}
                    </div>
                  </FormField>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="抓取频率">
                      <div className="grid grid-cols-2 gap-2">
                        {FREQ_OPTIONS.map((o) => (
                          <button key={o.value} onClick={() => setFormCategoryFreq(o.value)}
                            className={`rounded-lg border px-3 py-2 text-left text-xs transition-all ${formCategoryFreq === o.value ? "border-primary bg-primary/8 text-primary" : "border-border bg-surface text-ink-secondary hover:border-border/80"}`}>
                            <span className="font-medium">{o.label}</span>
                            <span className="ml-1 text-ink-tertiary">{o.desc}</span>
                          </button>
                        ))}
                      </div>
                    </FormField>
                    <FormField label="执行时间（北京时间）" hint={formCategoryFreq === "twice_daily" ? "每天两次：所选时间及 12 小时后各执行一次" : undefined}>
                      <select value={formCategoryTimeBj} onChange={(e) => setFormCategoryTimeBj(Number(e.target.value))} className="form-input">
                        {hourOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </FormField>
                  </div>
                </>
              )}

              {formQuery.trim() && formCategoryIds.length === 0 && (
                <>
                  <FormField label="每次数量" hint="单次最多抓取篇数">
                    <select value={formMax} onChange={(e) => setFormMax(Number(e.target.value))} className="form-input">
                      {[10, 20, 50].map((n) => <option key={n} value={n}>{n} 篇</option>)}
                    </select>
                  </FormField>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="抓取频率">
                      <div className="grid grid-cols-2 gap-2">
                        {FREQ_OPTIONS.map((o) => (
                          <button key={o.value} onClick={() => setFormFreq(o.value)}
                            className={`rounded-lg border px-3 py-2 text-left text-xs transition-all ${formFreq === o.value ? "border-primary bg-primary/8 text-primary" : "border-border bg-surface text-ink-secondary hover:border-border/80"}`}>
                            <span className="font-medium">{o.label}</span>
                            <span className="ml-1 text-ink-tertiary">{o.desc}</span>
                          </button>
                        ))}
                      </div>
                    </FormField>
                    <FormField label="执行时间（北京时间）" hint="系统在指定时间自动抓取">
                      <select value={formTimeBj} onChange={(e) => setFormTimeBj(Number(e.target.value))} className="form-input">
                        {hourOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </FormField>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  icon={editId ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={!formName.trim() || (formCategoryIds.length === 0 && !formQuery.trim())}
                >
                  {editId ? "保存修改" : "创建订阅"}
                </Button>
                <Button variant="secondary" onClick={resetForm}>取消</Button>
              </div>
            </div>
          </div>
        )}

        {/* 订阅列表 */}
        {loading ? (
          <Spinner text="加载订阅列表..." />
        ) : topics.length === 0 ? (
          <Empty icon={<Rss className="h-12 w-12" />} title="暂无订阅" description="创建订阅后系统会按设定的频率自动收集论文" action={<Button size="sm" onClick={openAdd}>创建第一个订阅</Button>} />
        ) : (
          <div className="space-y-3">
            {topics.map((t) => (
              <div key={t.id} className="space-y-3">
                <TopicCard
                  topic={t}
                  isCategory={!!(t.category_id || t.category_ids)}
                  fetching={fetchingTopicId === t.id}
                  fetchProgress={fetchProgress[t.id]}
                  onEdit={() => openEdit(t)}
                  onToggle={() => handleToggle(t)}
                  onDelete={() => setConfirmDeleteId(t.id)}
                onFetch={() => handleManualFetch(t.id)}
                onNavigate={() => navigate(`/papers?topicId=${t.id}`)}
                />
                {showForm && editId === t.id && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/[0.02] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Pencil className="h-4 w-4 text-primary" />
                        编辑订阅
                      </h3>
                      <button aria-label="关闭" onClick={resetForm} className="rounded-lg p-1 text-ink-tertiary hover:bg-hover"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="space-y-4">
                      <FormField label="订阅名称" hint="给这个订阅起个名字">
                        <input
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="例：Machine Learning 或 LLM Agent"
                          className="form-input"
                        />
                      </FormField>
                      <FormField label="arXiv 分类" hint="选择领域和具体分类，可多选；与关键词二选一或同时使用">
                        <CategorySelector
                          value={formCategoryIds}
                          onChange={(ids) => setFormCategoryIds(ids)}
                        />
                      </FormField>
                      <FormField label="搜索关键词" hint="arXiv API 搜索表达式；二者至少填一项，可同时使用">
                        <input value={formQuery} onChange={(e) => setFormQuery(e.target.value)} placeholder="all:NeRF AND all:3D 或直接输入关键词" className="form-input" />
                      </FormField>
                      <div className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.02] p-4">
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Sparkles className="h-3.5 w-3.5" /> AI 关键词助手
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input value={aiDesc} onChange={(e) => setAiDesc(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleAiSuggest(); }}
                              placeholder="用自然语言描述你的研究兴趣，AI 自动生成搜索词..."
                              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-ink placeholder:text-ink-placeholder focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20" />
                          </div>
                          <Button variant="secondary" size="sm" icon={aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            onClick={handleAiSuggest} disabled={aiLoading || (!aiDesc.trim() && !formQuery.trim() && !query.trim())}>
                            生成
                          </Button>
                        </div>
                        {suggestions.length > 0 && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {suggestions.map((s, i) => (
                              <button key={i} onClick={() => applySuggestion(s)}
                                className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-left transition-all hover:border-primary/30 hover:shadow-sm">
                                <Zap className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-ink">{s.name}</p>
                                  <p className="mt-0.5 font-mono text-[10px] text-primary/70">{s.query}</p>
                                  <p className="mt-0.5 text-[10px] text-ink-tertiary">{s.reason}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {formCategoryIds.length > 0 && (
                        <>
                          <FormField label="抓取模式" hint="数量模式按篇数；日期模式按论文更新时间">
                            <div className="space-y-3">
                              <div className="flex gap-4">
                                <label className="flex cursor-pointer items-center gap-2">
                                  <input
                                    type="radio"
                                    name="fetchMode"
                                    checked={formCategoryFetchMode === "quantity"}
                                    onChange={() => setFormCategoryFetchMode("quantity")}
                                    className="h-3.5 w-3.5"
                                  />
                                  <span className="text-xs">数量</span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                  <input
                                    type="radio"
                                    name="fetchMode"
                                    checked={formCategoryFetchMode === "date"}
                                    onChange={() => setFormCategoryFetchMode("date")}
                                    className="h-3.5 w-3.5"
                                  />
                                  <span className="text-xs">日期</span>
                                </label>
                              </div>
                              {formCategoryFetchMode === "quantity" ? (
                                <select value={formCategoryMax} onChange={(e) => setFormCategoryMax(Number(e.target.value))} className="form-input">
                                  {[10, 20, 50].map((n) => <option key={n} value={n}>{n} 篇</option>)}
                                </select>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-ink-secondary">最近</span>
                                  <select value={formCategoryDateDays} onChange={(e) => setFormCategoryDateDays(Number(e.target.value))} className="form-input">
                                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} 天</option>)}
                                  </select>
                                  <span className="text-xs text-ink-tertiary">（按论文更新时间）</span>
                                </div>
                              )}
                            </div>
                          </FormField>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <FormField label="抓取频率">
                              <div className="grid grid-cols-2 gap-2">
                                {FREQ_OPTIONS.map((o) => (
                                  <button key={o.value} onClick={() => setFormCategoryFreq(o.value)}
                                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-all ${formCategoryFreq === o.value ? "border-primary bg-primary/8 text-primary" : "border-border bg-surface text-ink-secondary hover:border-border/80"}`}>
                                    <span className="font-medium">{o.label}</span>
                                    <span className="ml-1 text-ink-tertiary">{o.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </FormField>
                            <FormField label="执行时间（北京时间）" hint={formCategoryFreq === "twice_daily" ? "每天两次：所选时间及 12 小时后各执行一次" : undefined}>
                              <select value={formCategoryTimeBj} onChange={(e) => setFormCategoryTimeBj(Number(e.target.value))} className="form-input">
                                {hourOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </FormField>
                          </div>
                        </>
                      )}
                      {formQuery.trim() && formCategoryIds.length === 0 && (
                        <>
                          <FormField label="每次数量" hint="单次最多抓取篇数">
                            <select value={formMax} onChange={(e) => setFormMax(Number(e.target.value))} className="form-input">
                              {[10, 20, 50].map((n) => <option key={n} value={n}>{n} 篇</option>)}
                            </select>
                          </FormField>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <FormField label="抓取频率">
                              <div className="grid grid-cols-2 gap-2">
                                {FREQ_OPTIONS.map((o) => (
                                  <button key={o.value} onClick={() => setFormFreq(o.value)}
                                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-all ${formFreq === o.value ? "border-primary bg-primary/8 text-primary" : "border-border bg-surface text-ink-secondary hover:border-border/80"}`}>
                                    <span className="font-medium">{o.label}</span>
                                    <span className="ml-1 text-ink-tertiary">{o.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </FormField>
                            <FormField label="执行时间（北京时间）" hint="系统在指定时间自动抓取">
                              <select value={formTimeBj} onChange={(e) => setFormTimeBj(Number(e.target.value))} className="form-input">
                                {hourOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </FormField>
                          </div>
                        </>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          onClick={handleSave}
                          loading={saving}
                          disabled={!formName.trim() || (formCategoryIds.length === 0 && !formQuery.trim())}
                        >
                          保存修改
                        </Button>
                        <Button variant="secondary" onClick={resetForm}>取消</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 订阅历史：论文订阅下方独立区块 */}
      <SubscriptionHistorySection
        topics={topics.filter((t) => t.category_id || t.category_ids)}
        selectedTopicId={runHistoryTopicId}
        onSelectTopic={setRunHistoryTopicId}
        onIngested={() => { topicApi.list(false).then((r) => setTopics(r.items)); }}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="删除订阅"
        description="删除后将停止自动收集该主题的论文，确定要删除吗？"
        variant="danger"
        confirmLabel="删除"
        onConfirm={async () => { if (confirmDeleteId) { await handleDelete(confirmDeleteId); setConfirmDeleteId(null); } }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}


/* ================================================================
 * 订阅卡片
 * ================================================================ */
function TopicCard({
  topic: t,
  isCategory = false,
  fetching,
  fetchProgress,
  onEdit,
  onToggle,
  onDelete,
  onFetch,
  onNavigate,
}: {
  topic: Topic;
  isCategory?: boolean;
  fetching: boolean;
  fetchProgress?: { progress_pct: number; message: string };
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onFetch: () => void;
  onNavigate: () => void;
}) {
  const bjHour = utcToBj(t.schedule_time_utc ?? 21);
  const freqLabel = FREQ_LABEL[t.schedule_frequency] || "每天";
  const dateModeLabel =
    (t.fetch_mode as string) === "date"
      ? `最近 ${t.date_filter_days ?? 7} 天（按更新时间）`
      : `每次 ${t.max_results_per_run} 篇`;
  const lastRunFailed = t.last_run_status === "failed";
  const lastRunError = t.last_run_error?.trim();

  return (
    <div className={`group rounded-xl border transition-all ${t.enabled ? "border-border bg-page hover:border-primary/20 hover:shadow-sm" : "border-border/50 bg-page/50 opacity-70"}`}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="mt-1.5 flex flex-col items-center gap-1">
          <div className={`h-2.5 w-2.5 rounded-full ${t.enabled ? "bg-success" : "bg-ink-tertiary"} ${t.enabled ? "animate-pulse" : ""}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{t.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.enabled ? "bg-success/10 text-success" : "bg-ink-tertiary/10 text-ink-tertiary"}`}>
              {t.enabled ? "运行中" : "已暂停"}
            </span>
          </div>

          <p className="mt-1 font-mono text-xs text-ink-tertiary">{t.query}</p>

          {fetching && (
            <div className="mt-2 space-y-1">
              {fetchProgress ? (
                <>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-tertiary/20">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(100, fetchProgress.progress_pct)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-ink-tertiary">{fetchProgress.message}</p>
                </>
              ) : (
                <p className="text-[11px] text-ink-tertiary">抓取中...</p>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-secondary">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {freqLabel} {String(bjHour).padStart(2, "0")}:00
            </span>
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {dateModeLabel}
            </span>
            {(t.paper_count ?? 0) > 0 && (
              <button onClick={onNavigate} className="flex items-center gap-1 text-primary hover:underline">
                <Library className="h-3 w-3" />
                已收集 {t.paper_count} 篇
              </button>
            )}
            {t.last_run_at && (
              <span className={`flex items-center gap-1 ${lastRunFailed ? "text-error" : ""}`}>
                <Calendar className="h-3 w-3" />
                上次: {timeAgo(t.last_run_at)}
                {t.last_run_count != null && <> · {t.last_run_count} 篇</>}
                {lastRunFailed && <> · 失败</>}
              </span>
            )}
          </div>
          {lastRunFailed && lastRunError && (
            <p className="mt-1.5 flex items-start gap-1 text-[11px] text-error">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">失败原因: {lastRunError}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onFetch}
            disabled={fetching}
            className="flex items-center gap-1.5 rounded-lg bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/15 disabled:opacity-50 disabled:cursor-not-allowed"
            title="立即抓取最新论文"
          >
            {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {fetching ? "抓取中..." : "手动抓取"}
          </button>

          <div className="mx-1 h-5 w-px bg-border" />

          <button aria-label="编辑" onClick={onEdit} disabled={fetching}
            className="rounded-lg p-1.5 text-ink-tertiary hover:bg-hover hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed" title="编辑订阅">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button aria-label={t.enabled ? "暂停" : "启用"} onClick={onToggle} disabled={fetching}
            className={`rounded-lg p-1.5 ${t.enabled ? "text-success hover:bg-success-light" : "text-ink-tertiary hover:bg-hover"} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={t.enabled ? "暂停自动抓取" : "启用自动抓取"}>
            {t.enabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
          </button>
          <button aria-label="删除" onClick={onDelete} disabled={fetching}
            className="rounded-lg p-1.5 text-ink-tertiary hover:bg-error-light hover:text-error disabled:opacity-50 disabled:cursor-not-allowed" title="删除订阅">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}


/* ================================================================
 * 订阅历史（论文订阅下方独立区块）
 * ================================================================ */
function SubscriptionHistorySection({
  topics,
  selectedTopicId,
  onSelectTopic,
  onIngested,
}: {
  topics: Topic[];
  selectedTopicId: string | null;
  onSelectTopic: (id: string | null) => void;
  onIngested: () => void;
}) {
  const { toast } = useToast();
  const [runs, setRuns] = useState<TopicRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<TopicRunDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ingesting, setIngesting] = useState(false);
  const [confirmDeleteRunId, setConfirmDeleteRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTopicId) {
      setRuns([]);
      setLoading(false);
      setExpandedRunId(null);
      setRunDetail(null);
      setSelectedIds(new Set());
      return;
    }
    setLoading(true);
    topicApi.listRuns(selectedTopicId).then((r) => { setRuns(r.items); setLoading(false); }).catch(() => setLoading(false));
  }, [selectedTopicId]);

  useEffect(() => {
    if (expandedRunId) {
      topicApi.getRun(expandedRunId).then(setRunDetail).catch(() => setRunDetail(null));
    } else {
      setRunDetail(null);
      setSelectedIds(new Set());
    }
  }, [expandedRunId]);

  const togglePaper = (arxivId: string, alreadyIngested: boolean) => {
    if (alreadyIngested) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(arxivId)) next.delete(arxivId);
      else next.add(arxivId);
      return next;
    });
  };

  const selectAllPapers = () => {
    if (!runDetail?.papers) return;
    const selectable = runDetail.papers.filter((p) => !p.already_ingested);
    setSelectedIds(new Set(selectable.map((p) => p.arxiv_id)));
  };

  const handleIngest = async () => {
    if (selectedIds.size === 0 || !expandedRunId) return;
    setIngesting(true);
    try {
      const res = await topicApi.ingestRunPapers(expandedRunId, Array.from(selectedIds));
      toast("success", `成功入库 ${res.ingested} 篇论文`);
      setSelectedIds(new Set());
      onIngested();
      topicApi.getRun(expandedRunId).then(setRunDetail);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "入库失败");
    } finally {
      setIngesting(false);
    }
  };

  const handleDeleteRun = async () => {
    if (!confirmDeleteRunId || !selectedTopicId) return;
    try {
      await topicApi.deleteRun(confirmDeleteRunId);
      toast("success", "已删除该运行记录");
      setConfirmDeleteRunId(null);
      if (expandedRunId === confirmDeleteRunId) {
        setExpandedRunId(null);
        setRunDetail(null);
        setSelectedIds(new Set());
      }
      topicApi.listRuns(selectedTopicId).then((r) => setRuns(r.items));
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "删除失败");
    }
  };

  if (topics.length === 0) return null;

  return (
    <>
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-primary/8 p-2"><RefreshCw className="h-4 w-4 text-primary" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">订阅历史</h2>
            <p className="text-xs text-ink-tertiary">查看抓取记录，勾选论文入库</p>
          </div>
        </div>
        <select
          value={selectedTopicId ?? ""}
          onChange={(e) => onSelectTopic(e.target.value || null)}
          className="h-9 shrink-0 rounded-lg border border-border bg-page px-3 text-xs text-ink"
        >
          <option value="">选择订阅</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {!selectedTopicId ? (
        <p className="py-8 text-center text-xs text-ink-tertiary">请选择订阅查看运行历史</p>
      ) : loading ? (
        <Spinner text="加载运行历史..." />
      ) : runs.length === 0 ? (
        <Empty icon={<RefreshCw className="h-12 w-12" />} title="暂无运行记录" description="手动抓取后，结果会保存在这里" />
      ) : (
        <div className="space-y-2">
          {runs.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-page">
              <div className="flex items-center">
                <button
                  onClick={() => setExpandedRunId(expandedRunId === r.id ? null : r.id)}
                  className="flex flex-1 items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-secondary">
                      {r.run_at ? formatDateTime(r.run_at) : "-"}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {r.paper_count} 篇
                    </span>
                    {r.status === "failed" && (
                      <span className="text-[10px] text-error">失败</span>
                    )}
                  </div>
                  {expandedRunId === r.id ? (
                    <ChevronDown className="h-4 w-4 text-ink-tertiary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-ink-tertiary" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteRunId(r.id); }}
                  aria-label="删除该运行记录"
                  className="shrink-0 rounded-lg p-2 text-ink-tertiary transition-colors hover:bg-error/10 hover:text-error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {expandedRunId === r.id && runDetail && (
                <div className="border-t border-border px-4 py-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-secondary">勾选要入库的论文</span>
                      <Button variant="secondary" size="sm" onClick={selectAllPapers}>
                        全选
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleIngest}
                      loading={ingesting}
                      disabled={selectedIds.size === 0}
                    >
                      入库选中 ({selectedIds.size})
                    </Button>
                  </div>
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {(runDetail.papers || []).map((p: TopicRunPaper) => (
                      <label
                        key={p.arxiv_id}
                        className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                          p.already_ingested ? "bg-success/5 opacity-70" : "hover:bg-hover"
                        } ${selectedIds.has(p.arxiv_id) ? "bg-primary/10" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.arxiv_id)}
                          onChange={() => togglePaper(p.arxiv_id, p.already_ingested ?? false)}
                          disabled={p.already_ingested}
                          className="mt-1 h-3.5 w-3.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-ink">{p.title}</p>
                          <p className="mt-0.5 text-[10px] text-ink-tertiary">
                            {p.arxiv_id}
                            {p.already_ingested && (
                              <span className="ml-2 text-success">已入库</span>
                            )}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    <ConfirmDialog
      open={confirmDeleteRunId !== null}
      title="删除运行记录"
      description="确定要删除该抓取记录吗？删除后无法恢复。"
      variant="danger"
      confirmLabel="删除"
      onConfirm={handleDeleteRun}
      onCancel={() => setConfirmDeleteRunId(null)}
    />
    </>
  );
}


/* ================================================================
 * 即时搜索结果卡片（勾选入库，类似订阅历史）
 * ================================================================ */
function SearchResultCard({
  result: r,
  onToggle,
  onTogglePaper,
  onSelectAll,
  onIngest,
  onNavigate,
}: {
  result: SearchResult;
  onToggle: () => void;
  onTogglePaper: (arxivId: string, alreadyIngested: boolean) => void;
  onSelectAll: () => void;
  onIngest: () => Promise<void>;
  onNavigate: (paperId: string) => void;
}) {
  const [ingesting, setIngesting] = useState(false);
  const handleIngest = async () => {
    setIngesting(true);
    try {
      await onIngest();
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-page transition-all">
      {/* 头部：摘要信息 */}
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Search className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">&quot;{r.query}&quot;</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {r.papers.length} 篇
            </span>
          </div>
          {r.papers.length > 0 && !r.expanded && (
            <p className="mt-0.5 truncate text-xs text-ink-tertiary">
              {r.papers.slice(0, 3).map((p) => p.title).join(" · ")}
            </p>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-ink-tertiary">{r.time}</span>
        {r.papers.length > 0 &&
          (r.expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" />
          ))}
      </button>

      {/* 展开：论文列表 + 勾选入库 */}
      {r.expanded && r.papers.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-secondary">勾选要入库的论文</span>
              <Button variant="secondary" size="sm" onClick={onSelectAll}>
                全选
              </Button>
            </div>
            <Button size="sm" onClick={handleIngest} loading={ingesting} disabled={r.selectedIds.size === 0}>
              入库选中 ({r.selectedIds.size})
            </Button>
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {r.papers.map((p) => (
              <label
                key={p.arxiv_id}
                className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                  p.already_ingested ? "bg-success/5 opacity-70" : "hover:bg-hover"
                } ${r.selectedIds.has(p.arxiv_id) ? "bg-primary/10" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={r.selectedIds.has(p.arxiv_id)}
                  onChange={() => onTogglePaper(p.arxiv_id, p.already_ingested ?? false)}
                  disabled={p.already_ingested}
                  className="mt-1 h-3.5 w-3.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{p.title}</p>
                  <p className="mt-0.5 text-[10px] text-ink-tertiary">
                    {p.arxiv_id}
                    {p.already_ingested && <span className="ml-2 text-success">已入库</span>}
                  </p>
                </div>
                {p.already_ingested && p.paper_id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(p.paper_id!);
                    }}
                    className="shrink-0 rounded-md p-1 text-ink-tertiary transition-colors hover:bg-primary/10 hover:text-primary"
                    title="查看论文"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/* ================================================================
 * 通用表单字段
 * ================================================================ */
function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-ink-secondary">{label}</label>
      {hint && <p className="text-[10px] text-ink-tertiary">{hint}</p>}
      {children}
    </div>
  );
}
