/**
 * Input + Textarea — form controls.
 *
 * Optional leftIcon / rightIcon adornments; hint or error footer below.
 *
 * @author Bamzc
 */
import { cn } from "@/lib/utils";
import {
	forwardRef,
	type InputHTMLAttributes,
	type ReactNode,
	type TextareaHTMLAttributes,
} from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	hint?: string;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ label, error, hint, leftIcon, rightIcon, className, ...rest },
	ref,
) {
	const hasIconLeft = !!leftIcon;
	const hasIconRight = !!rightIcon;
	return (
		<div className="flex flex-col gap-1.5">
			{label && (
				<label className="text-[13px] font-medium text-ink">{label}</label>
			)}
			<div className="relative">
				{hasIconLeft && (
					<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary [&_svg]:h-4 [&_svg]:w-4">
						{leftIcon}
					</span>
				)}
				<input
					ref={ref}
					className={cn(
						"h-10 w-full rounded-lg border bg-surface text-[14px] text-ink",
						"transition-[border-color,box-shadow] duration-fast ease-standard",
						"placeholder:text-ink-placeholder",
						"focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15",
						"disabled:cursor-not-allowed disabled:opacity-50",
						hasIconLeft ? "pl-10" : "pl-3.5",
						hasIconRight ? "pr-10" : "pr-3.5",
						error
							? "border-error focus:border-error focus:ring-error/15"
							: "border-border hover:border-border-strong",
						className,
					)}
					{...rest}
				/>
				{hasIconRight && (
					<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary [&_svg]:h-4 [&_svg]:w-4">
						{rightIcon}
					</span>
				)}
			</div>
			{error ? (
				<p className="text-xs text-error">{error}</p>
			) : hint ? (
				<p className="text-xs text-ink-tertiary">{hint}</p>
			) : null}
		</div>
	);
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string;
	error?: string;
	hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
	{ label, error, hint, className, ...rest },
	ref,
) {
	return (
		<div className="flex flex-col gap-1.5">
			{label && (
				<label className="text-[13px] font-medium text-ink">{label}</label>
			)}
			<textarea
				ref={ref}
				className={cn(
					"min-h-[88px] w-full resize-y rounded-lg border bg-surface px-3.5 py-2.5 text-[14px] text-ink",
					"transition-[border-color,box-shadow] duration-fast ease-standard",
					"placeholder:text-ink-placeholder",
					"focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15",
					"disabled:cursor-not-allowed disabled:opacity-50",
					error
						? "border-error focus:border-error focus:ring-error/15"
						: "border-border hover:border-border-strong",
					className,
				)}
				{...rest}
			/>
			{error ? (
				<p className="text-xs text-error">{error}</p>
			) : hint ? (
				<p className="text-xs text-ink-tertiary">{hint}</p>
			) : null}
		</div>
	);
});
