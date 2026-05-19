/**
 * Tooltip — small floating label on hover / focus.
 *
 * Intentionally CSS-only (no portal, no collision detection). For richer
 * floating UI use a dedicated library. Triggered by hover or focus-within
 * on the wrapping span; appears after a short delay.
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
	label: ReactNode;
	side?: Side;
	children: ReactNode;
	className?: string;
}

const positionStyles: Record<Side, string> = {
	top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
	bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
	left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
	right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
};

export function Tooltip({ label, side = "top", children, className }: TooltipProps) {
	return (
		<span className={cn("group/tip relative inline-flex", className)}>
			{children}
			<span
				role="tooltip"
				className={cn(
					"pointer-events-none absolute z-popover whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-page shadow-md",
					"opacity-0 transition-opacity delay-150 duration-fast ease-standard",
					"group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
					positionStyles[side],
				)}
			>
				{label}
			</span>
		</span>
	);
}
