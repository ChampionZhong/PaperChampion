/**
 * Empty — zero-state placeholder.
 *
 * Caller must provide title (no hardcoded copy default).
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyProps {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
	dense?: boolean;
}

export function Empty({
	icon,
	title,
	description,
	action,
	className,
	dense,
}: EmptyProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center text-center",
				dense ? "py-8" : "py-20",
				className,
			)}
		>
			<div className="mb-4 text-ink-tertiary [&_svg]:mx-auto">
				{icon ?? <Inbox className="h-10 w-10" strokeWidth={1.5} />}
			</div>
			<h3 className="text-[15px] font-medium text-ink">{title}</h3>
			{description && (
				<p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-secondary">
					{description}
				</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}
