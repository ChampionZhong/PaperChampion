/**
 * UserMenu — sidebar footer popover.
 *
 * Houses the Settings entry, theme toggle, version label and Sign-out.
 * Expanded: avatar + name + chevron. Collapsed: avatar only, popover anchors
 * to the icon rail with extra right offset.
 *
 * @author Bamzc
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Moon, Settings as SettingsIcon, Sun } from "lucide-react";
import { Avatar, Divider } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { clearAuth } from "@/services/api";

const SettingsDialog = lazy(() =>
	import("./SettingsDialog").then((m) => ({ default: m.SettingsDialog })),
);

interface UserMenuProps {
	collapsed: boolean;
	name?: string;
	version?: string;
	onLogout?: () => void;
}

export function UserMenu({
	collapsed,
	name = "You",
	version = "v0.2.0",
	onLogout,
}: UserMenuProps) {
	const [open, setOpen] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const { dark, toggle } = useTheme();
	const wrapRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) return;
		const onClick = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const handleLogout = useCallback(() => {
		setOpen(false);
		if (onLogout) {
			onLogout();
		} else {
			clearAuth();
			window.location.reload();
		}
	}, [onLogout]);

	const handleOpenSettings = useCallback(() => {
		setShowSettings(true);
		setOpen(false);
	}, []);

	return (
		<>
			<div ref={wrapRef} className="relative">
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					className={cn(
						"flex w-full items-center rounded-lg text-left transition-colors duration-fast ease-standard",
						"hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
						collapsed ? "h-10 justify-center" : "h-11 gap-2.5 px-2",
					)}
					aria-haspopup="menu"
					aria-expanded={open}
				>
					<Avatar name={name} size={collapsed ? "sm" : "sm"} />
					{!collapsed && (
						<>
							<span className="flex-1 truncate text-[13px] font-medium text-ink">
								{name}
							</span>
							<ChevronDown
								className={cn(
									"h-3.5 w-3.5 shrink-0 text-ink-tertiary transition-transform duration-fast",
									open && "-rotate-180",
								)}
							/>
						</>
					)}
				</button>
				{open && (
					<div
						role="menu"
						className={cn(
							"absolute z-popover w-56 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-md animate-scale-in",
							collapsed
								? "bottom-0 left-[calc(100%+8px)]"
								: "bottom-[calc(100%+6px)] left-0 right-0",
						)}
					>
						<MenuItem icon={<SettingsIcon className="h-4 w-4" />} onClick={handleOpenSettings}>
							设置
						</MenuItem>
						<MenuItem
							icon={dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
							onClick={toggle}
						>
							{dark ? "亮色模式" : "暗色模式"}
						</MenuItem>
						<Divider className="my-1" />
						<div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-tertiary">
							{version}
						</div>
						<Divider className="my-1" />
						<MenuItem
							icon={<LogOut className="h-4 w-4" />}
							onClick={handleLogout}
							tone="danger"
						>
							退出登录
						</MenuItem>
					</div>
				)}
			</div>
			{showSettings && (
				<Suspense fallback={null}>
					<SettingsDialog onClose={() => setShowSettings(false)} />
				</Suspense>
			)}
		</>
	);
}

interface MenuItemProps {
	icon: React.ReactNode;
	onClick: () => void;
	children: React.ReactNode;
	tone?: "default" | "danger";
}

function MenuItem({ icon, onClick, children, tone = "default" }: MenuItemProps) {
	return (
		<button
			type="button"
			role="menuitem"
			onClick={onClick}
			className={cn(
				"flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors duration-fast ease-standard",
				tone === "danger"
					? "text-error hover:bg-error-light"
					: "text-ink hover:bg-hover",
				"focus-visible:outline-none focus-visible:bg-hover",
			)}
		>
			<span className="shrink-0 text-ink-tertiary">{icon}</span>
			<span className="flex-1 text-left">{children}</span>
		</button>
	);
}
