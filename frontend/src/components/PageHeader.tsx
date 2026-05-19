/**
 * PageHeader — sticky in-page chrome for non-Agent routes.
 *
 * Renders:
 *   - title (sans, large, bold, with optional module-accent underline)
 *   - optional subtitle
 *   - optional actions slot (right-aligned)
 *
 * Sits at the top of the page's container, sticky on scroll so the title
 * remains visible while scrolling long content.
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import { Dot } from "@/components/ui";
import { moduleForPath, type ModuleKey } from "@/lib/tokens";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

interface PageHeaderProps {
	title: ReactNode;
	subtitle?: ReactNode;
	actions?: ReactNode;
	module?: ModuleKey;
	className?: string;
	dense?: boolean;
}

export function PageHeader({
	title,
	subtitle,
	actions,
	module,
	className,
	dense,
}: PageHeaderProps) {
	const { pathname } = useLocation();
	const resolvedModule = module ?? moduleForPath(pathname);

	return (
		<header
			className={cn(
				"sticky top-0 z-sticky -mx-4 mb-6 bg-page/85 px-4 backdrop-blur-md lg:-mx-8 lg:px-8",
				dense ? "py-3" : "py-5",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<Dot module={resolvedModule} size={6} />
						<h1
							className={cn(
								"truncate font-semibold leading-tight tracking-tight text-ink",
								dense ? "text-[18px]" : "text-[22px]",
							)}
						>
							{title}
						</h1>
					</div>
					{subtitle && (
						<p className="mt-2.5 truncate text-[13px] text-ink-secondary">{subtitle}</p>
					)}
				</div>
				{actions && (
					<div className="flex shrink-0 items-center gap-2">{actions}</div>
				)}
			</div>
		</header>
	);
}
