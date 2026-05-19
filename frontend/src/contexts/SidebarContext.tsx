/**
 * SidebarContext — shared collapse / mobile-drawer state for the app shell.
 *
 * Sidebar component reads it to switch between the 260 px expanded and 64 px
 * icon-rail layouts. Layout reads `collapsed` to size the main canvas margin.
 *
 * Collapse state is persisted to localStorage; mobile-drawer state is per-session.
 *
 * @author Bamzc
 */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";

const STORAGE_KEY = "sidebar_collapsed";

interface SidebarCtx {
	collapsed: boolean;
	toggleCollapsed: () => void;
	setCollapsed: (v: boolean) => void;
	mobileOpen: boolean;
	setMobileOpen: (v: boolean) => void;
}

const Ctx = createContext<SidebarCtx | null>(null);

function initialCollapsed(): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(STORAGE_KEY) === "1";
}

export function SidebarProvider({ children }: { children: ReactNode }) {
	const [collapsed, setCollapsedRaw] = useState<boolean>(initialCollapsed);
	const [mobileOpen, setMobileOpen] = useState<boolean>(false);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
	}, [collapsed]);

	const setCollapsed = useCallback((v: boolean) => setCollapsedRaw(v), []);
	const toggleCollapsed = useCallback(() => setCollapsedRaw((c) => !c), []);

	return (
		<Ctx.Provider
			value={{ collapsed, toggleCollapsed, setCollapsed, mobileOpen, setMobileOpen }}
		>
			{children}
		</Ctx.Provider>
	);
}

export function useSidebar(): SidebarCtx {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
	return ctx;
}
