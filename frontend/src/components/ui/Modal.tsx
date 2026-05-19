/**
 * Modal — overlay panel with optional header / body / footer.
 *
 * Behavior:
 *   - rendered via React portal into document.body so any ancestor with
 *     `transform`, `filter`, or `perspective` (e.g. the sliding Sidebar)
 *     cannot trap the `position: fixed` panel inside its containing block
 *   - locks body scroll while open
 *   - Esc closes
 *   - clicking the backdrop closes (disable via closeOnBackdrop)
 *   - focuses the first interactive element inside on mount
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import {
	useEffect,
	useRef,
	type MouseEvent,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Width = "sm" | "md" | "lg" | "xl" | "full";

export interface ModalProps {
	open?: boolean;
	onClose: () => void;
	title?: ReactNode;
	subtitle?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
	width?: Width;
	closeOnBackdrop?: boolean;
	hideCloseButton?: boolean;
}

const widthStyles: Record<Width, string> = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-2xl",
	xl: "max-w-4xl",
	full: "max-w-[calc(100vw-2rem)]",
};

const FOCUSABLE_SELECTOR =
	"button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function Modal({
	open = true,
	onClose,
	title,
	subtitle,
	children,
	footer,
	className,
	width = "md",
	closeOnBackdrop = true,
	hideCloseButton = false,
}: ModalProps) {
	const panelRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) return;
		document.body.style.overflow = "hidden";
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
		first?.focus();
		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", onKey);
		};
	}, [open, onClose]);

	if (!open) return null;
	if (typeof document === "undefined") return null;

	const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
		if (e.target === e.currentTarget && closeOnBackdrop) onClose();
	};

	const showHeader = !!title || !hideCloseButton;

	const overlay = (
		<div
			className="fixed inset-0 z-modal flex items-center justify-center px-4 py-8"
			onClick={onBackdropClick}
		>
			<div className="pointer-events-none absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-[2px]" />
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				className={cn(
					"relative z-10 flex w-full max-h-[calc(100vh-4rem)] flex-col overflow-hidden",
					"rounded-2xl border border-border bg-surface shadow-lg animate-scale-in",
					widthStyles[width],
					className,
				)}
			>
				{showHeader && (
					<div className="flex items-start justify-between gap-4 border-b border-border-light px-6 py-4">
						<div className="min-w-0 flex-1">
							{title && (
								<h2 className="truncate text-base font-semibold leading-tight text-ink">
									{title}
								</h2>
							)}
							{subtitle && (
								<p className="mt-2 text-xs text-ink-secondary">{subtitle}</p>
							)}
						</div>
						{!hideCloseButton && (
							<button
								type="button"
								onClick={onClose}
								aria-label="Close"
								className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition-colors duration-fast hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							>
								<X className="h-4 w-4" />
							</button>
						)}
					</div>
				)}
				<div className="flex-1 overflow-auto px-6 py-5">{children}</div>
				{footer && (
					<div className="flex items-center justify-end gap-2 border-t border-border-light bg-page/60 px-6 py-4">
						{footer}
					</div>
				)}
			</div>
		</div>
	);

	return createPortal(overlay, document.body);
}
