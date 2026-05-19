/**
 * Badge — compact label for state / count / tag.
 *
 * Variants: default / primary / success / warning / error / info
 * Tones:    subtle (soft bg + colored text) / solid (full color) / outline
 *
 * For module-colored markers (Agent / Papers / …) use <Dot module="papers" />.
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant = "default" | "primary" | "success" | "warning" | "error" | "info";
type Tone = "subtle" | "solid" | "outline";

interface BadgeProps {
	variant?: Variant;
	tone?: Tone;
	children: ReactNode;
	className?: string;
}

const subtleStyles: Record<Variant, string> = {
	default: "bg-hover text-ink-secondary",
	primary: "bg-primary-light text-primary-strong",
	success: "bg-success-light text-success",
	warning: "bg-warning-light text-warning",
	error: "bg-error-light text-error",
	info: "bg-info-light text-info",
};

const solidStyles: Record<Variant, string> = {
	default: "bg-ink-secondary text-page",
	primary: "bg-primary text-white",
	success: "bg-success text-white",
	warning: "bg-warning text-white",
	error: "bg-error text-white",
	info: "bg-info text-white",
};

const outlineStyles: Record<Variant, string> = {
	default: "border border-border text-ink-secondary",
	primary: "border border-primary/40 text-primary",
	success: "border border-success/40 text-success",
	warning: "border border-warning/40 text-warning",
	error: "border border-error/40 text-error",
	info: "border border-info/40 text-info",
};

export function Badge({
	variant = "default",
	tone = "subtle",
	children,
	className,
}: BadgeProps) {
	const styles =
		tone === "subtle" ? subtleStyles : tone === "solid" ? solidStyles : outlineStyles;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight",
				styles[variant],
				className,
			)}
		>
			{children}
		</span>
	);
}
