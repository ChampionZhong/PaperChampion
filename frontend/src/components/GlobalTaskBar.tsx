/**
 * GlobalTaskBar — floating top-right pill that surfaces background tasks.
 *
 * Collapsed (default): small pill with running count + spinner.
 * Expanded: dropdown card listing in-flight + recently completed tasks.
 * Hidden entirely when there are no tasks at all.
 *
 * @author Bamzc
 */
import { useEffect, useRef, useState } from "react";
import {
	CheckCircle2,
	ChevronDown,
	Loader2,
	XCircle,
} from "lucide-react";
import { useGlobalTasks, type ActiveTask } from "@/contexts/GlobalTaskContext";
import { cn } from "@/lib/utils";

function TaskRow({ task }: { task: ActiveTask }) {
	const pct = task.progress_pct;
	const StatusIcon = task.finished
		? task.success
			? CheckCircle2
			: XCircle
		: Loader2;
	const statusClass = task.finished
		? task.success
			? "text-success"
			: "text-error"
		: "animate-spin text-primary";

	return (
		<div className="flex items-start gap-2.5 px-3 py-2.5">
			<StatusIcon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", statusClass)} />
			<div className="min-w-0 flex-1">
				<div className="flex items-center justify-between gap-2">
					<p className="truncate text-[12.5px] font-medium text-ink">{task.title}</p>
					<span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-tertiary">
						{task.total > 0 ? `${task.current}/${task.total}` : ""}
						{!task.finished && task.total > 0 ? " · " : ""}
						{!task.finished ? `${task.elapsed_seconds}s` : ""}
					</span>
				</div>
				{task.message && (
					<p className="mt-0.5 truncate text-[11px] text-ink-secondary">
						{task.message}
					</p>
				)}
				{!task.finished && task.total > 0 && (
					<div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border">
						<div
							className="h-full rounded-full bg-primary transition-[width] duration-normal ease-standard"
							style={{ width: `${pct}%` }}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

export default function GlobalTaskBar() {
	const { tasks, hasRunning } = useGlobalTasks();
	const [expanded, setExpanded] = useState(false);
	const wrapRef = useRef<HTMLDivElement | null>(null);

	const running = tasks.filter((t) => !t.finished);
	const recent = tasks.filter((t) => t.finished).slice(0, 3);
	const total = running.length + recent.length;

	useEffect(() => {
		if (!expanded) return;
		const onClick = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
				setExpanded(false);
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setExpanded(false);
		};
		document.addEventListener("mousedown", onClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [expanded]);

	if (total === 0) return null;

	return (
		<div ref={wrapRef} className="fixed right-4 top-3 z-overlay">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				aria-haspopup="dialog"
				aria-expanded={expanded}
				className={cn(
					"inline-flex h-9 items-center gap-2 rounded-full border bg-surface px-3 text-[12px] font-medium shadow-xs",
					"transition-[border-color,background-color,box-shadow] duration-fast ease-standard",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
					hasRunning
						? "border-primary/40 text-primary-strong"
						: "border-border text-ink-secondary",
					"hover:border-border-strong hover:shadow-sm",
				)}
			>
				{hasRunning ? (
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
				) : (
					<CheckCircle2 className="h-3.5 w-3.5 text-success" />
				)}
				<span>
					{hasRunning
						? `${running.length} 个任务运行中`
						: `${recent.length} 个任务完成`}
				</span>
				<ChevronDown
					className={cn(
						"h-3 w-3 shrink-0 text-ink-tertiary transition-transform duration-fast",
						expanded && "-rotate-180",
					)}
				/>
			</button>

			{expanded && (
				<div
					role="dialog"
					aria-label="Active tasks"
					className="absolute right-0 top-[calc(100%+8px)] w-[320px] overflow-hidden rounded-xl border border-border bg-surface shadow-md animate-scale-in"
				>
					<header className="border-b border-border-light px-3 py-2.5">
						<p className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-ink-tertiary">
							任务进度
						</p>
					</header>
					<div className="max-h-[60vh] divide-y divide-border-light overflow-y-auto">
						{running.map((t) => (
							<TaskRow key={t.task_id} task={t} />
						))}
						{recent.map((t) => (
							<TaskRow key={t.task_id} task={t} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}
