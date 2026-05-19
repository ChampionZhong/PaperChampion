/**
 * PaperChampion bootstrap.
 *
 * Web mode renders <App /> directly. Tauri mode probes for setup, then waits
 * for the sidecar backend's port broadcast before mounting <App />.
 *
 * Editorial Lab refresh: dropped the slate gradient loading splash for the
 * warm off-white surface used across the rest of the app.
 *
 * @author Bamzc
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import App from "./App";
import LogoIcon from "@/assets/logo-icon.svg?react";
import { isTauri, needsSetup, waitForBackend, setApiPort, listen } from "@/lib/tauri";

const SetupWizard = lazy(() => import("@/pages/SetupWizard"));

type Phase = "checking" | "setup" | "waiting" | "ready";

function LoadingScreen({ message, error }: { message: string; error?: string }) {
	return (
		<div className="flex h-screen w-screen flex-col items-center justify-center gap-5 bg-page px-6">
			<LogoIcon className="h-10 w-10 text-primary" />
			<p className="font-display text-[20px] font-semibold leading-tight tracking-tight text-ink">
				PaperChampion
			</p>
			{error ? (
				<>
					<p className="text-[13px] font-medium text-error">后端启动失败</p>
					<p className="max-w-sm text-center text-[12px] text-error/80">{error}</p>
				</>
			) : (
				<>
					<div className="flex items-center gap-2 text-[12.5px] text-ink-secondary">
						<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
						<span>{message}</span>
					</div>
				</>
			)}
		</div>
	);
}

export default function DesktopBootstrap() {
	const [phase, setPhase] = useState<Phase>(isTauri() ? "checking" : "ready");
	const [backendError, setBackendError] = useState("");

	useEffect(() => {
		if (!isTauri()) return;

		let unlistenError: (() => void) | null = null;

		(async () => {
			unlistenError = await listen<string>("backend-error", (msg) => {
				setBackendError(msg);
			});

			const setup = await needsSetup();
			if (setup) {
				setPhase("setup");
			} else {
				setPhase("waiting");
				const port = await waitForBackend();
				setApiPort(port);
				setPhase("ready");
			}
		})();

		return () => {
			unlistenError?.();
		};
	}, []);

	if (phase === "ready") {
		return <App />;
	}

	if (phase === "setup") {
		return (
			<Suspense fallback={<LoadingScreen message="加载引导页…" />}>
				<SetupWizard
					onReady={(port: number) => {
						setApiPort(port);
						setPhase("ready");
					}}
				/>
			</Suspense>
		);
	}

	return (
		<LoadingScreen
			message={phase === "checking" ? "正在检查配置…" : "正在启动后端服务…"}
			error={backendError || undefined}
		/>
	);
}
