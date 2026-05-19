/**
 * Divider — separator line.
 *
 * Variants:
 *   horizontal (default) : full-width hairline; optional centered label
 *   vertical             : self-stretching column line
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";

interface DividerProps {
	orientation?: "horizontal" | "vertical";
	dashed?: boolean;
	className?: string;
	label?: string;
}

export function Divider({
	orientation = "horizontal",
	dashed,
	label,
	className,
}: DividerProps) {
	if (orientation === "vertical") {
		return (
			<span
				role="separator"
				aria-orientation="vertical"
				className={cn(
					"inline-block h-full w-px self-stretch bg-border",
					dashed && "border-l border-dashed border-border bg-transparent",
					className,
				)}
			/>
		);
	}
	if (label) {
		return (
			<div
				role="separator"
				className={cn(
					"flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-ink-tertiary",
					className,
				)}
			>
				<span
					className={cn(
						"h-px flex-1 bg-border",
						dashed && "border-t border-dashed border-border bg-transparent",
					)}
				/>
				<span className="font-medium">{label}</span>
				<span
					className={cn(
						"h-px flex-1 bg-border",
						dashed && "border-t border-dashed border-border bg-transparent",
					)}
				/>
			</div>
		);
	}
	return (
		<hr
			className={cn(
				"my-2 h-px w-full border-0 bg-border",
				dashed && "border-t border-dashed border-border bg-transparent",
				className,
			)}
		/>
	);
}
