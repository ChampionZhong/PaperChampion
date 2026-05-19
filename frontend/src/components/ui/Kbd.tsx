/**
 * Kbd — keyboard shortcut indicator.
 *
 * Renders one or more keys as small bordered tokens.
 *
 * Example: <Kbd keys={["⌘", "B"]} separator="+" />
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import { Fragment, type ReactNode } from "react";

interface KbdProps {
	keys: ReactNode[];
	separator?: ReactNode;
	className?: string;
}

export function Kbd({ keys, separator, className }: KbdProps) {
	return (
		<span className={cn("inline-flex items-center gap-1 font-mono text-[10.5px]", className)}>
			{keys.map((key, i) => (
				<Fragment key={i}>
					<kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-surface px-1 font-medium text-ink-secondary">
						{key}
					</kbd>
					{i < keys.length - 1 && separator !== undefined && (
						<span className="text-ink-tertiary">{separator}</span>
					)}
				</Fragment>
			))}
		</span>
	);
}
