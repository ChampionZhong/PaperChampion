/**
 * Design tokens — Editorial Lab system.
 *
 * Source of truth lives in `src/index.css` under the `@theme {}` block.
 * This file mirrors a subset of those tokens as type-safe constants
 * for TypeScript consumers (canvas APIs, motion props, conditional
 * className composition). Most styling should stay in Tailwind utility
 * classes that Tailwind v4 generates from the @theme variables.
 *
 * @author Bamzc
 */

/** Module accent colors — used as 4 px dots / active-tab underlines / page-header marks. */
export const moduleAccents = {
	agent: "#4F46E5",
	collect: "#0D9488",
	papers: "#7C3AED",
	brief: "#0284C7",
	graph: "#D97706",
	wiki: "#059669",
	writing: "#E11D48",
	dashboard: "#475569",
} as const;

export type ModuleKey = keyof typeof moduleAccents;

/** Dark-mode module accents — brighter variants for the deeper background. */
export const moduleAccentsDark: Record<ModuleKey, string> = {
	agent: "#818CF8",
	collect: "#2DD4BF",
	papers: "#A78BFA",
	brief: "#38BDF8",
	graph: "#FBBF24",
	wiki: "#34D399",
	writing: "#FB7185",
	dashboard: "#94A3B8",
};

/** Route prefix → module key mapping. Used by Sidebar + PageHeader. */
export const routeToModule: Record<string, ModuleKey> = {
	"/": "agent",
	"/collect": "collect",
	"/papers": "papers",
	"/brief": "brief",
	"/graph": "graph",
	"/wiki": "wiki",
	"/writing": "writing",
	"/dashboard": "dashboard",
};

/** Resolve the module key for a pathname; defaults to "agent". */
export function moduleForPath(pathname: string): ModuleKey {
	for (const prefix of Object.keys(routeToModule).sort((a, b) => b.length - a.length)) {
		if (pathname === prefix || pathname.startsWith(prefix + "/")) {
			return routeToModule[prefix];
		}
	}
	return "agent";
}

/** Motion scale — milliseconds. Match `--duration-*` in index.css. */
export const motion = {
	instant: 80,
	fast: 150,
	normal: 220,
	slow: 360,
} as const;

/** Easing curves — match `--ease-*` in index.css. */
export const easing = {
	standard: "cubic-bezier(0.2, 0, 0, 1)",
	emphasized: "cubic-bezier(0.3, 0, 0, 1)",
	out: "cubic-bezier(0, 0, 0.2, 1)",
} as const;

/** Radius scale — pixels. Match `--radius-*` in index.css. */
export const radius = {
	sm: 6,
	md: 10,
	lg: 14,
	xl: 20,
	xxl: 28,
	pill: 9999,
} as const;
