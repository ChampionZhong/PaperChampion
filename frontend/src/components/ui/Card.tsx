/**
 * Card — surface container.
 *
 * Variants:
 *   default     : 1px hairline border, no shadow
 *   elevated    : shadow-sm, no border (used sparingly for headlines)
 *   interactive : default + hover-lift, used for clickable list rows
 *
 * Padding scale: none / sm (16) / md (20) / lg (28).
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type Variant = "default" | "elevated" | "interactive";
type Padding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	variant?: Variant;
	padding?: Padding;
	children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
	default: "bg-surface border border-border",
	elevated: "bg-surface shadow-sm",
	interactive:
		"bg-surface border border-border cursor-pointer hover:border-border-strong hover:shadow-sm transition-[border-color,box-shadow] duration-normal ease-standard",
};

const paddingStyles: Record<Padding, string> = {
	none: "",
	sm: "p-4",
	md: "p-5",
	lg: "p-7",
};

export function Card({
	variant = "default",
	padding = "md",
	children,
	className,
	...rest
}: CardProps) {
	return (
		<div
			className={cn("rounded-xl", variantStyles[variant], paddingStyles[padding], className)}
			{...rest}
		>
			{children}
		</div>
	);
}

interface CardHeaderProps {
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
	return (
		<div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
			<div className="min-w-0 flex-1">
				<h3 className="text-[15px] font-semibold leading-snug text-ink">{title}</h3>
				{description && (
					<p className="mt-2 text-sm leading-relaxed text-ink-secondary">{description}</p>
				)}
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}
