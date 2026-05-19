/**
 * Dot — colored circle, used as module identifier or status indicator.
 *
 * Examples:
 *   <Dot module="papers" />          // 6 px violet dot
 *   <Dot color="#10B981" pulse />    // 6 px green dot with pulse
 *   <Dot size={8} />                 // inherits text color via bg-current
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/lib/tokens";

interface DotProps {
	size?: 4 | 6 | 8;
	module?: ModuleKey;
	color?: string;
	pulse?: boolean;
	className?: string;
}

const moduleBg: Record<ModuleKey, string> = {
	agent: "bg-mod-agent",
	collect: "bg-mod-collect",
	papers: "bg-mod-papers",
	brief: "bg-mod-brief",
	graph: "bg-mod-graph",
	wiki: "bg-mod-wiki",
	writing: "bg-mod-writing",
	dashboard: "bg-mod-dashboard",
};

const sizeStyles: Record<4 | 6 | 8, string> = {
	4: "h-1 w-1",
	6: "h-1.5 w-1.5",
	8: "h-2 w-2",
};

export function Dot({ size = 6, module, color, pulse, className }: DotProps) {
	return (
		<span
			className={cn(
				"inline-block shrink-0 rounded-full",
				module ? moduleBg[module] : "bg-current",
				sizeStyles[size],
				pulse && "animate-pulse-soft",
				className,
			)}
			style={!module && color ? { backgroundColor: color } : undefined}
		/>
	);
}
