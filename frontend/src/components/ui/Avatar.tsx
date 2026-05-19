/**
 * Avatar — user or agent identity glyph.
 *
 * Shows the supplied image, or falls back to up-to-two initial letters
 * over a primary-tinted background.
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

interface AvatarProps {
	name: string;
	src?: string;
	size?: Size;
	className?: string;
}

const sizeStyles: Record<Size, string> = {
	xs: "h-5 w-5 text-[9px]",
	sm: "h-7 w-7 text-[11px]",
	md: "h-8 w-8 text-xs",
	lg: "h-10 w-10 text-sm",
};

function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
	const first = parts[0]?.[0] ?? "";
	const last = parts[parts.length - 1]?.[0] ?? "";
	return (first + last).toUpperCase();
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
	return (
		<span
			aria-label={name}
			className={cn(
				"inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary-light font-semibold text-primary-strong",
				sizeStyles[size],
				className,
			)}
		>
			{src ? (
				<img src={src} alt={name} className="h-full w-full object-cover" />
			) : (
				<span>{initialsOf(name)}</span>
			)}
		</span>
	);
}
