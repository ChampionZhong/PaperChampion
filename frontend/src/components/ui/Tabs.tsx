/**
 * Tabs — segmented or underline navigation.
 *
 * Variants:
 *   pill      (default) : rounded segment background, ChatGPT-like
 *   underline           : flat row with underline on active, Editorial Lab style
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Tab {
	id: string;
	label: ReactNode;
	disabled?: boolean;
}

interface TabsProps {
	tabs: Tab[];
	active: string;
	onChange: (id: string) => void;
	variant?: "pill" | "underline";
	className?: string;
}

export function Tabs({
	tabs,
	active,
	onChange,
	variant = "pill",
	className,
}: TabsProps) {
	if (variant === "underline") {
		return (
			<div
				role="tablist"
				className={cn("flex items-center gap-6 border-b border-border", className)}
			>
				{tabs.map((tab) => {
					const isActive = active === tab.id;
					return (
						<button
							key={tab.id}
							role="tab"
							type="button"
							aria-selected={isActive}
							disabled={tab.disabled}
							onClick={() => onChange(tab.id)}
							className={cn(
								"relative -mb-px inline-flex h-10 items-center gap-1.5 px-1 text-[13px] font-medium",
								"transition-colors duration-fast ease-standard",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm",
								isActive ? "text-ink" : "text-ink-tertiary hover:text-ink-secondary",
								tab.disabled && "pointer-events-none opacity-40",
							)}
						>
							{tab.label}
							<span
								className={cn(
									"absolute -bottom-px left-0 right-0 h-[2px] bg-primary transition-opacity duration-fast",
									isActive ? "opacity-100" : "opacity-0",
								)}
							/>
						</button>
					);
				})}
			</div>
		);
	}

	return (
		<div
			role="tablist"
			className={cn(
				"inline-flex items-center gap-1 rounded-lg border border-border bg-page/60 p-1",
				className,
			)}
		>
			{tabs.map((tab) => {
				const isActive = active === tab.id;
				return (
					<button
						key={tab.id}
						role="tab"
						type="button"
						aria-selected={isActive}
						disabled={tab.disabled}
						onClick={() => onChange(tab.id)}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium",
							"transition-all duration-fast ease-standard",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
							isActive
								? "bg-surface text-ink shadow-xs"
								: "text-ink-secondary hover:text-ink",
							tab.disabled && "pointer-events-none opacity-40",
						)}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
