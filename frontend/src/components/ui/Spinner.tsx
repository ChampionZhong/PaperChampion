/**
 * Spinner — loading indicator.
 *
 * Modes:
 *   block  : centered in a padded column (page-level loads)
 *   inline : glyph only, no container
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Size = "xs" | "sm" | "md" | "lg";
type Mode = "block" | "inline";

interface SpinnerProps {
	size?: Size;
	mode?: Mode;
	text?: string;
	className?: string;
}

const sizeStyles: Record<Size, string> = {
	xs: "h-3 w-3",
	sm: "h-4 w-4",
	md: "h-6 w-6",
	lg: "h-8 w-8",
};

export function Spinner({ size = "md", mode = "block", text, className }: SpinnerProps) {
	const glyph = (
		<Loader2 className={cn("animate-spin text-ink-tertiary", sizeStyles[size])} />
	);
	if (mode === "inline") {
		return <span className={cn("inline-flex items-center", className)}>{glyph}</span>;
	}
	return (
		<div className={cn("flex flex-col items-center justify-center gap-3 py-16", className)}>
			{glyph}
			{text && <p className="text-sm text-ink-tertiary">{text}</p>}
		</div>
	);
}
