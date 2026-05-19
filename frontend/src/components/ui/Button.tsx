/**
 * Button — primary interactive primitive.
 *
 * Variants:
 *   primary     : brand-colored solid (default for confirm / CTA)
 *   secondary   : surface-on-page with border (default for neutral actions)
 *   ghost       : hover-only background (toolbar buttons, menu rows)
 *   outline     : transparent with brand border (rare; opt-in cards)
 *   destructive : error-colored solid (deletion confirms only)
 *
 * Sizes: sm (h-8) / md (h-9) / lg (h-11).
 *
 * Loading replaces leftIcon with a spinner and disables the button.
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
	iconLeft?: ReactNode;
	iconRight?: ReactNode;
	children?: ReactNode;
}

const variantStyles: Record<Variant, string> = {
	primary:
		"bg-primary text-white hover:bg-primary-hover active:bg-primary-strong shadow-xs",
	secondary:
		"bg-surface text-ink border border-border hover:border-border-strong hover:bg-hover active:bg-active",
	ghost:
		"text-ink-secondary hover:bg-hover hover:text-ink active:bg-active",
	outline:
		"text-primary border border-primary/40 hover:bg-primary-light hover:border-primary active:bg-primary-light",
	destructive:
		"bg-error text-white hover:brightness-95 active:brightness-90 shadow-xs",
};

const sizeStyles: Record<Size, string> = {
	sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
	md: "h-9 px-4 text-[13px] gap-2 rounded-lg",
	lg: "h-11 px-5 text-[14px] gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{
		variant = "primary",
		size = "md",
		loading = false,
		iconLeft,
		iconRight,
		children,
		className,
		disabled,
		...rest
	},
	ref,
) {
	return (
		<button
			ref={ref}
			className={cn(
				"inline-flex select-none items-center justify-center font-medium",
				"transition-[color,background-color,border-color,box-shadow] duration-fast ease-standard",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-page",
				"disabled:pointer-events-none disabled:opacity-50",
				variantStyles[variant],
				sizeStyles[size],
				className,
			)}
			disabled={disabled || loading}
			{...rest}
		>
			{loading ? (
				<Loader2 className="h-4 w-4 shrink-0 animate-spin" />
			) : (
				iconLeft && <span className="inline-flex shrink-0">{iconLeft}</span>
			)}
			{children}
			{!loading && iconRight && (
				<span className="inline-flex shrink-0">{iconRight}</span>
			)}
		</button>
	);
});
