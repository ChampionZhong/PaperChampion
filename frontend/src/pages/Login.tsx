/**
 * Login — single-password gate.
 *
 * Editorial Lab refresh: warm off-white surface, serif display brand,
 * hairline-border card, indigo CTA. Dark slate gradient retired.
 *
 * @author Color2333
 */
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import LogoIcon from "@/assets/logo-icon.svg?react";
import { Button, Input } from "@/components/ui";
import { authApi } from "@/services/api";

interface LoginPageProps {
	onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				const status = await authApi.status();
				if (!status.auth_enabled) onLoginSuccess();
			} catch {
				// fall through to login UI
			}
		})();
	}, [onLoginSuccess]);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!password.trim()) {
			setError("请输入密码");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const result = await authApi.login(password);
			localStorage.setItem("auth_token", result.access_token);
			onLoginSuccess();
		} catch (err) {
			setError(err instanceof Error ? err.message : "登录失败，请重试");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-page px-4 py-12">
			<div className="w-full max-w-sm">
				<div className="mb-10 flex flex-col items-center text-center">
					<LogoIcon className="mb-5 h-10 w-10 text-primary" />
					<h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink">
						PaperChampion
					</h1>
					<p className="mt-3 text-[13px] text-ink-secondary">
						AI 驱动的学术论文研究平台
					</p>
				</div>

				<form
					onSubmit={handleSubmit}
					className="rounded-2xl border border-border bg-surface p-6 shadow-xs"
				>
					<Input
						type={showPassword ? "text" : "password"}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="访问密码"
						label="密码"
						disabled={loading}
						autoFocus
						rightIcon={
							<button
								type="button"
								onClick={() => setShowPassword((v) => !v)}
								className="pointer-events-auto text-ink-tertiary transition-colors hover:text-ink-secondary"
								aria-label={showPassword ? "隐藏密码" : "显示密码"}
								tabIndex={-1}
							>
								{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
						}
						error={error || undefined}
					/>

					<Button
						type="submit"
						disabled={loading}
						loading={loading}
						className="mt-4 w-full"
					>
						{loading ? "验证中…" : "进入系统"}
					</Button>
				</form>

				<p className="mt-6 text-center text-[11px] text-ink-tertiary">
					{loading && (
						<Loader2 className="-mt-0.5 mr-1 inline h-3 w-3 animate-spin" />
					)}
					Editorial Lab · v0.2.0
				</p>
			</div>
		</div>
	);
}
