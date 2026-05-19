/**
 * Sidebar — ChatGPT-style app shell.
 *
 * Five regions, top to bottom:
 *   1. Brand row + collapse toggle
 *   2. New-chat button (full pill expanded, icon-only collapsed)
 *   3. Optional running-task indicator (single line, only when expanded)
 *   4. Module navigation (8 flat items with module-accent dots)
 *   5. Conversation history (date-grouped, hidden when collapsed)
 *   6. User menu (popover with Settings / theme / version / Sign-out)
 *
 * Width: 260 px expanded, 64 px icon rail when collapsed.
 * Keyboard: ⌘B / Ctrl+B toggles collapse (ignored when an input is focused).
 * Mobile: slides over as a drawer; hamburger fixed top-left when closed.
 *
 * @author Color2333
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
	BookOpen,
	ChevronLeft,
	FileText,
	LayoutDashboard,
	Menu,
	MessageSquare,
	Network,
	Newspaper,
	PenTool,
	Plus,
	Search,
	Sparkles,
	Trash2,
	X,
	type LucideIcon,
} from "lucide-react";

import LogoIcon from "@/assets/logo-icon.svg?react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { UserMenu } from "@/components/UserMenu";
import { Badge, Dot, IconButton, Tooltip } from "@/components/ui";
import { useConversationCtx } from "@/contexts/ConversationContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { groupByDate, type ConversationMeta } from "@/hooks/useConversations";
import type { ModuleKey } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { paperApi } from "@/services/api";

interface ModuleDef {
	to: string;
	icon: LucideIcon;
	label: string;
	module: ModuleKey;
	exact?: boolean;
}

const MODULES: ModuleDef[] = [
	{ to: "/", icon: Sparkles, label: "Agent", module: "agent", exact: true },
	{ to: "/collect", icon: Search, label: "论文收集", module: "collect" },
	{ to: "/papers", icon: FileText, label: "论文库", module: "papers" },
	{ to: "/brief", icon: Newspaper, label: "研究简报", module: "brief" },
	{ to: "/graph", icon: Network, label: "引用图谱", module: "graph" },
	{ to: "/wiki", icon: BookOpen, label: "Wiki", module: "wiki" },
	{ to: "/writing", icon: PenTool, label: "写作助手", module: "writing" },
	{ to: "/dashboard", icon: LayoutDashboard, label: "看板", module: "dashboard" },
];

export default function Sidebar() {
	const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();
	const {
		metas,
		activeId,
		createConversation,
		switchConversation,
		deleteConversation,
	} = useConversationCtx();
	const navigate = useNavigate();
	const location = useLocation();
	const [unreadCount, setUnreadCount] = useState(0);
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const groups = useMemo(() => groupByDate(metas), [metas]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "b" || e.shiftKey) return;
			const t = document.activeElement;
			const tag = t?.tagName ?? "";
			if (tag === "INPUT" || tag === "TEXTAREA" || (t as HTMLElement)?.isContentEditable) {
				return;
			}
			e.preventDefault();
			toggleCollapsed();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [toggleCollapsed]);

	useEffect(() => {
		const fetchUnread = () => {
			paperApi
				.folderStats()
				.then((s: { by_status?: { unread?: number } }) =>
					setUnreadCount(s?.by_status?.unread ?? 0),
				)
				.catch(() => {});
		};
		fetchUnread();
		const t = setInterval(fetchUnread, 60000);
		return () => clearInterval(t);
	}, []);

	useEffect(() => {
		setMobileOpen(false);
	}, [location.pathname, setMobileOpen]);

	const handleNewChat = useCallback(() => {
		createConversation();
		if (location.pathname !== "/") navigate("/");
		setMobileOpen(false);
	}, [createConversation, location.pathname, navigate, setMobileOpen]);

	const handleSelectChat = useCallback(
		(id: string) => {
			switchConversation(id);
			if (location.pathname !== "/") navigate("/");
			setMobileOpen(false);
		},
		[switchConversation, location.pathname, navigate, setMobileOpen],
	);

	return (
		<>
			<button
				type="button"
				onClick={() => setMobileOpen(true)}
				aria-label="Open menu"
				className="fixed left-3 top-3 z-overlay inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-ink shadow-xs lg:hidden"
			>
				<Menu className="h-4 w-4" />
			</button>

			{mobileOpen && (
				<div
					className="fixed inset-0 z-modal animate-fade-in bg-ink/30 backdrop-blur-[2px] lg:hidden"
					onClick={() => setMobileOpen(false)}
				/>
			)}

			<aside
				aria-label="Primary"
				className={cn(
					"fixed left-0 top-0 z-modal flex h-screen flex-col border-r border-border bg-sidebar",
					"transition-[width,transform] duration-normal ease-standard",
					mobileOpen ? "translate-x-0 shadow-md" : "-translate-x-full lg:translate-x-0",
					collapsed ? "w-16" : "w-[260px]",
				)}
			>
				<BrandRow collapsed={collapsed} onToggle={toggleCollapsed} />

				<button
					type="button"
					onClick={() => setMobileOpen(false)}
					aria-label="Close menu"
					className="absolute right-2 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-tertiary hover:bg-hover hover:text-ink lg:hidden"
				>
					<X className="h-4 w-4" />
				</button>

				<div className={cn("px-3 pb-2", collapsed && "px-2")}>
					<NewChatButton collapsed={collapsed} onClick={handleNewChat} />
				</div>

				<nav
					aria-label="Modules"
					className={cn(
						"flex flex-col gap-0.5 px-3 pb-3",
						collapsed && "items-center px-2",
					)}
				>
					{MODULES.map((mod) => (
						<ModuleLink
							key={mod.to}
							def={mod}
							collapsed={collapsed}
							badge={
								mod.module === "papers" && unreadCount > 0 ? unreadCount : undefined
							}
						/>
					))}
				</nav>

				{!collapsed ? (
					<HistoryList
						groups={groups}
						activeId={activeId}
						onSelect={handleSelectChat}
						onDelete={setDeleteId}
					/>
				) : (
					<div className="flex-1" />
				)}

				<div className={cn("p-2", collapsed && "px-1")}>
					<UserMenu collapsed={collapsed} />
				</div>
			</aside>

			<ConfirmDialog
				open={!!deleteId}
				title="删除对话"
				description="删除后无法恢复。"
				variant="danger"
				confirmLabel="删除"
				onConfirm={() => {
					if (deleteId) {
						deleteConversation(deleteId);
						setDeleteId(null);
					}
				}}
				onCancel={() => setDeleteId(null)}
			/>
		</>
	);
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface BrandRowProps {
	collapsed: boolean;
	onToggle: () => void;
}

function BrandRow({ collapsed, onToggle }: BrandRowProps) {
	if (collapsed) {
		return (
			<div className="flex h-14 shrink-0 items-center justify-center px-2">
				<Tooltip label="展开 ⌘B" side="right">
					<button
						type="button"
						onClick={onToggle}
						aria-label="Expand sidebar"
						className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-primary transition-colors duration-fast hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<LogoIcon className="h-6 w-6" />
					</button>
				</Tooltip>
			</div>
		);
	}
	return (
		<div className="flex h-14 shrink-0 items-center justify-between px-3">
			<div className="flex min-w-0 items-center gap-2">
				<LogoIcon className="h-7 w-7 shrink-0 text-primary" />
				<span className="truncate font-display text-[15px] font-semibold tracking-tight text-ink">
					PaperChampion
				</span>
			</div>
			<Tooltip label="收起 ⌘B" side="bottom">
				<IconButton
					variant="ghost"
					size="sm"
					onClick={onToggle}
					aria-label="Collapse sidebar"
				>
					<ChevronLeft />
				</IconButton>
			</Tooltip>
		</div>
	);
}

interface NewChatButtonProps {
	collapsed: boolean;
	onClick: () => void;
}

function NewChatButton({ collapsed, onClick }: NewChatButtonProps) {
	if (collapsed) {
		return (
			<Tooltip label="新对话" side="right">
				<IconButton
					variant="primary"
					size="lg"
					onClick={onClick}
					aria-label="New chat"
				>
					<Plus />
				</IconButton>
			</Tooltip>
		);
	}
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"group flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-ink",
				"transition-all duration-fast ease-standard",
				"hover:border-border-strong hover:bg-hover hover:shadow-xs",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
			)}
		>
			<Plus className="h-4 w-4 text-primary" />
			<span className="flex-1 text-left">新对话</span>
		</button>
	);
}

interface ModuleLinkProps {
	def: ModuleDef;
	collapsed: boolean;
	badge?: number;
}

function ModuleLink({ def, collapsed, badge }: ModuleLinkProps) {
	const Icon = def.icon;

	const linkClass = (isActive: boolean) =>
		cn(
			"flex items-center transition-colors duration-fast ease-standard",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
			collapsed
				? "h-10 w-10 justify-center rounded-lg"
				: "h-9 gap-2.5 rounded-lg px-3",
			isActive
				? "bg-hover text-ink"
				: "text-ink-secondary hover:bg-hover hover:text-ink",
		);

	const link = (
		<NavLink to={def.to} end={def.exact} className={({ isActive }) => linkClass(isActive)}>
			{({ isActive }) => (
				<>
					<Icon
						className={cn(
							"h-4 w-4 shrink-0",
							isActive ? "text-ink" : "text-ink-tertiary",
						)}
					/>
					{!collapsed && (
						<>
							<span className="flex-1 truncate text-[13px] font-medium leading-tight">
								{def.label}
							</span>
							{badge !== undefined && (
								<Badge variant="primary" tone="solid" className="px-1.5">
									{badge > 99 ? "99+" : badge}
								</Badge>
							)}
							<Dot
								module={def.module}
								size={6}
								className={cn(!isActive && "opacity-60")}
							/>
						</>
					)}
				</>
			)}
		</NavLink>
	);

	if (collapsed) {
		return (
			<Tooltip label={def.label} side="right">
				{link}
			</Tooltip>
		);
	}
	return link;
}

interface HistoryListProps {
	groups: ReturnType<typeof groupByDate>;
	activeId: string | null;
	onSelect: (id: string) => void;
	onDelete: (id: string) => void;
}

function HistoryList({ groups, activeId, onSelect, onDelete }: HistoryListProps) {
	return (
		<div className="flex-1 overflow-y-auto px-3 pt-2 pb-3">
			{groups.length === 0 ? (
				<p className="px-2 py-6 text-center text-[12px] text-ink-tertiary">
					还没有对话记录
				</p>
			) : (
				groups.map((group) => (
					<div key={group.label} className="mb-3 last:mb-0">
						<p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
							{group.label}
						</p>
						<ul className="flex flex-col gap-0.5">
							{group.items.map((meta) => (
								<HistoryRow
									key={meta.id}
									meta={meta}
									active={meta.id === activeId}
									onSelect={() => onSelect(meta.id)}
									onDelete={() => onDelete(meta.id)}
								/>
							))}
						</ul>
					</div>
				))
			)}
		</div>
	);
}

interface HistoryRowProps {
	meta: ConversationMeta;
	active: boolean;
	onSelect: () => void;
	onDelete: () => void;
}

function HistoryRow({ meta, active, onSelect, onDelete }: HistoryRowProps) {
	return (
		<li>
			<button
				type="button"
				onClick={onSelect}
				className={cn(
					"group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]",
					"transition-colors duration-fast ease-standard",
					active
						? "bg-primary-light text-primary-strong"
						: "text-ink-secondary hover:bg-hover hover:text-ink",
				)}
			>
				<MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
				<span className="flex-1 truncate">{meta.title}</span>
				<span
					role="button"
					tabIndex={0}
					aria-label="Delete conversation"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.stopPropagation();
							onDelete();
						}
					}}
					className="hidden shrink-0 rounded p-0.5 text-ink-tertiary hover:bg-error-light hover:text-error group-hover:flex"
				>
					<Trash2 className="h-3 w-3" />
				</span>
			</button>
		</li>
	);
}
