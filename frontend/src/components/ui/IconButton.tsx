/**
 * IconButton — square button for icon-only actions.
 *
 * Always pass `aria-label` for accessibility (compiler enforces).
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "ghost" | "subtle" | "primary";
type Size = "sm" | "md" | "lg";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	children: ReactNode;
	"aria-label": string;
}

const variantStyles: Record<Variant, string> = {
	ghost: "text-ink-tertiary hover:bg-hover hover:text-ink active:bg-active",
	subtle: "bg-hover text-ink-secondary hover:bg-active hover:text-ink",
	primary:
		"bg-primary text-white shadow-xs hover:bg-primary-hover active:bg-primary-strong",
};

const sizeStyles: Record<Size, string> = {
	sm: "h-7 w-7 rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5",
	md: "h-8 w-8 rounded-md [&_svg]:h-4 [&_svg]:w-4",
	lg: "h-10 w-10 rounded-lg [&_svg]:h-5 [&_svg]:w-5",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
	function IconButton({ variant = "ghost", size = "md", children, className, ...rest }, ref) {
		return (
			<button
				ref={ref}
				type="button"
				className={cn(
					"inline-flex shrink-0 items-center justify-center",
					"transition-colors duration-fast ease-standard",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
					"disabled:pointer-events-none disabled:opacity-40",
					variantStyles[variant],
					sizeStyles[size],
					className,
				)}
				{...rest}
			>
				{children}
			</button>
		);
	},
);
