/**
 * Agent session — per-conversation SSE + items + loading state.
 *
 * Each conversation maintains its own independent stream, abort controller,
 * loading flag, pending-action set, and items array. Switching the active
 * conversation does NOT cancel the SSE of the previous one; the user can
 * start a new conversation while another is still streaming, and switch
 * back later to see the completed result.
 *
 * @author Bamzc
 */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { agentApi } from "@/services/api";
import type { AgentMessage, SSEEvent, SSEEventType } from "@/types";
import { parseSSEStream } from "@/types";
import { useConversationCtx } from "@/contexts/ConversationContext";
import { loadConversation } from "@/hooks/useConversations";
import type { ConversationMessage } from "@/hooks/useConversations";

/* ========== Shared types ========== */

export interface ChatItem {
	id: string;
	type: "user" | "assistant" | "step_group" | "action_confirm" | "error" | "artifact";
	content: string;
	streaming?: boolean;
	steps?: StepItem[];
	actionId?: string;
	actionDescription?: string;
	actionTool?: string;
	toolArgs?: Record<string, unknown>;
	artifactTitle?: string;
	artifactContent?: string;
	artifactIsHtml?: boolean;
	timestamp: Date;
}

export interface StepItem {
	id: string;
	status: "running" | "done" | "error";
	toolName: string;
	toolArgs?: Record<string, unknown>;
	success?: boolean;
	summary?: string;
	data?: Record<string, unknown>;
	progressMessage?: string;
	progressCurrent?: number;
	progressTotal?: number;
}

export interface CanvasData {
	title: string;
	markdown: string;
	isHtml?: boolean;
}

/* ========== Context ========== */

interface AgentSessionCtx {
	items: ChatItem[];
	loading: boolean;
	pendingActions: Set<string>;
	confirmingActions: Set<string>;
	canvas: CanvasData | null;
	hasPendingConfirm: boolean;
	setCanvas: (v: CanvasData | null) => void;
	sendMessage: (text: string) => Promise<void>;
	handleConfirm: (actionId: string) => Promise<void>;
	handleReject: (actionId: string) => Promise<void>;
	stopGeneration: () => void;
}

const Ctx = createContext<AgentSessionCtx | null>(null);

const EMPTY_ITEMS: ChatItem[] = [];
const EMPTY_SET = new Set<string>();

function chatItemFromMessage(m: ConversationMessage): ChatItem {
	return {
		id: m.id,
		type: m.type,
		content: m.content,
		timestamp: new Date(m.timestamp),
		streaming: false,
		steps: m.steps,
		actionId: m.actionId,
		actionDescription: m.actionDescription,
		actionTool: m.actionTool,
		toolArgs: m.toolArgs,
		artifactTitle: m.artifactTitle,
		artifactContent: m.artifactContent,
		artifactIsHtml: m.artifactIsHtml,
	};
}

export function AgentSessionProvider({ children }: { children: React.ReactNode }) {
	const { activeId, createConversation, saveMessages } = useConversationCtx();

	/* ─── Per-conversation state ────────────────────────────────────────── */
	const [itemsByConv, setItemsByConv] = useState<Record<string, ChatItem[]>>({});
	const [loadingByConv, setLoadingByConv] = useState<Record<string, boolean>>({});
	const [pendingByConv, setPendingByConv] = useState<Record<string, Set<string>>>({});
	const [confirmingByConv, setConfirmingByConv] = useState<Record<string, Set<string>>>({});
	const [canvas, setCanvas] = useState<CanvasData | null>(null);

	/* ─── Per-conversation refs (not React state) ───────────────────────── */
	const abortByConv = useRef<Record<string, AbortController>>({});
	const streamBufByConv = useRef<Record<string, string>>({});
	const rafIdByConv = useRef<Record<string, number>>({});
	const itemsByConvRef = useRef<Record<string, ChatItem[]>>({});
	itemsByConvRef.current = itemsByConv;
	const loadedConvsRef = useRef<Set<string>>(new Set());
	const activeIdRef = useRef(activeId);
	activeIdRef.current = activeId;

	/* ─── Mutators that target a specific conversation ──────────────────── */
	const updateItems = useCallback(
		(convId: string, updater: (prev: ChatItem[]) => ChatItem[]) => {
			setItemsByConv((all) => ({ ...all, [convId]: updater(all[convId] ?? []) }));
		},
		[],
	);

	const setLoadingFor = useCallback((convId: string, v: boolean) => {
		setLoadingByConv((all) => ({ ...all, [convId]: v }));
	}, []);

	const addPendingFor = useCallback((convId: string, actionId: string) => {
		setPendingByConv((all) => {
			const next = new Set(all[convId] ?? []);
			next.add(actionId);
			return { ...all, [convId]: next };
		});
	}, []);

	const removePendingFor = useCallback((convId: string, actionId: string) => {
		setPendingByConv((all) => {
			const next = new Set(all[convId] ?? []);
			next.delete(actionId);
			return { ...all, [convId]: next };
		});
	}, []);

	const setConfirmingFor = useCallback(
		(convId: string, actionId: string, on: boolean) => {
			setConfirmingByConv((all) => {
				const next = new Set(all[convId] ?? []);
				if (on) next.add(actionId);
				else next.delete(actionId);
				return { ...all, [convId]: next };
			});
		},
		[],
	);

	/* ─── Stream buffer management (per-conversation) ───────────────────── */
	const drainBufferFor = useCallback((convId: string): string => {
		const rafId = rafIdByConv.current[convId];
		if (rafId !== undefined) {
			cancelAnimationFrame(rafId);
			delete rafIdByConv.current[convId];
		}
		const text = streamBufByConv.current[convId] ?? "";
		streamBufByConv.current[convId] = "";
		return text;
	}, []);

	const flushStreamBufferFor = useCallback(
		(convId: string) => {
			const text = streamBufByConv.current[convId] ?? "";
			if (!text) return;
			streamBufByConv.current[convId] = "";
			updateItems(convId, (prev) => {
				const last = prev[prev.length - 1];
				if (last && last.type === "assistant" && last.streaming) {
					const copy = [...prev];
					copy[copy.length - 1] = { ...last, content: last.content + text };
					return copy;
				}
				return [
					...prev,
					{
						id: `asst_${Date.now()}`,
						type: "assistant" as const,
						content: text,
						streaming: true,
						timestamp: new Date(),
					},
				];
			});
		},
		[updateItems],
	);

	const scheduleFlushFor = useCallback(
		(convId: string) => {
			if (rafIdByConv.current[convId] !== undefined) return;
			rafIdByConv.current[convId] = requestAnimationFrame(() => {
				delete rafIdByConv.current[convId];
				flushStreamBufferFor(convId);
			});
		},
		[flushStreamBufferFor],
	);

	const cancelStreamFor = useCallback((convId: string) => {
		const ac = abortByConv.current[convId];
		if (ac) {
			ac.abort();
			delete abortByConv.current[convId];
		}
	}, []);

	useEffect(() => {
		// Tear down all in-flight streams on unmount
		return () => {
			Object.values(abortByConv.current).forEach((ac) => ac.abort());
			Object.values(rafIdByConv.current).forEach((id) => cancelAnimationFrame(id));
		};
	}, []);

	/* ─── Load conversation messages on first switch into it ────────────── */
	useEffect(() => {
		if (!activeId) return;
		if (loadedConvsRef.current.has(activeId)) return;
		loadedConvsRef.current.add(activeId);
		const conv = loadConversation(activeId);
		if (conv && conv.messages.length > 0) {
			updateItems(activeId, () => conv.messages.map(chatItemFromMessage));
		}
	}, [activeId, updateItems]);

	/* ─── Persist active conversation (debounced) ───────────────────────── */
	const buildSavePayload = useCallback(
		(snapshot: ChatItem[], pendingTail: string): ConversationMessage[] => {
			return snapshot.map((it) => {
				const base: ConversationMessage = {
					id: it.id,
					type: it.type,
					content: it.streaming ? it.content + pendingTail : it.content,
					timestamp: it.timestamp.toISOString(),
				};
				if (it.type === "step_group" && it.steps) base.steps = it.steps;
				if (it.type === "action_confirm") {
					base.actionId = it.actionId;
					base.actionDescription = it.actionDescription;
					base.actionTool = it.actionTool;
					base.toolArgs = it.toolArgs;
				}
				if (it.type === "artifact") {
					base.artifactTitle = it.artifactTitle;
					base.artifactContent = it.artifactContent;
					base.artifactIsHtml = it.artifactIsHtml;
				}
				return base;
			});
		},
		[],
	);

	useEffect(() => {
		if (!activeId) return;
		const current = itemsByConv[activeId];
		if (!current || current.length === 0) return;
		const timer = setTimeout(() => {
			const msgs = buildSavePayload(
				current.filter((it) => !it.streaming),
				"",
			);
			if (msgs.length > 0) saveMessages(msgs);
		}, 1000);
		return () => clearTimeout(timer);
	}, [itemsByConv, activeId, saveMessages, buildSavePayload]);

	useEffect(() => {
		const handler = () => {
			const id = activeIdRef.current;
			if (!id) return;
			const current = itemsByConvRef.current[id];
			if (!current || current.length === 0) return;
			const tail = streamBufByConv.current[id] ?? "";
			const msgs = buildSavePayload(current, tail);
			if (msgs.length > 0) saveMessages(msgs);
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [buildSavePayload, saveMessages]);

	/* ─── Helpers ────────────────────────────────────────────────────────── */
	const applyPendingText = (copy: ChatItem[], pendingText: string): void => {
		const lastIdx = copy.length - 1;
		if (lastIdx < 0) {
			if (pendingText) {
				copy.push({
					id: `asst_${Date.now()}`,
					type: "assistant" as const,
					content: pendingText,
					streaming: false,
					timestamp: new Date(),
				});
			}
			return;
		}
		const last = copy[lastIdx];
		if (last.type === "assistant" && last.streaming) {
			copy[lastIdx] = { ...last, content: last.content + pendingText, streaming: false };
		} else if (pendingText) {
			copy.push({
				id: `asst_${Date.now()}`,
				type: "assistant" as const,
				content: pendingText,
				streaming: false,
				timestamp: new Date(),
			});
		}
	};

	/* ─── SSE event handler — bound to a specific conversation ──────────── */
	const processSSE = useCallback(
		(convId: string, event: SSEEvent) => {
			const { type, data } = event;
			const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			const setItems = (updater: (prev: ChatItem[]) => ChatItem[]) =>
				updateItems(convId, updater);
			const isActive = activeIdRef.current === convId;

			switch (type as SSEEventType) {
				case "text_delta": {
					streamBufByConv.current[convId] =
						(streamBufByConv.current[convId] ?? "") + ((data.content as string) || "");
					scheduleFlushFor(convId);
					break;
				}
				case "tool_start": {
					const pending = drainBufferFor(convId);
					setItems((prev) => {
						const copy = [...prev];
						applyPendingText(copy, pending);
						const toolName = data.name as string;
						const toolArgs = data.args as Record<string, unknown>;
						const stepId = (data.id as string) || id;
						const last = copy[copy.length - 1];
						if (last && last.type === "step_group") {
							const steps = [...(last.steps || [])];
							steps.push({ id: stepId, status: "running", toolName, toolArgs });
							copy[copy.length - 1] = { ...last, steps };
							return copy;
						}
						return [
							...copy,
							{
								id,
								type: "step_group" as const,
								content: "",
								steps: [{ id: stepId, status: "running", toolName, toolArgs }],
								timestamp: new Date(),
							},
						];
					});
					break;
				}
				case "tool_progress": {
					const progId = (data.id as string) || "";
					const progMsg = (data.message as string) || "";
					const progCur = (data.current as number) || 0;
					const progTotal = (data.total as number) || 0;
					setItems((prev) => {
						const copy = [...prev];
						for (let i = copy.length - 1; i >= 0; i--) {
							if (copy[i].type === "step_group" && copy[i].steps) {
								const steps = [...copy[i].steps!];
								const idx = progId
									? steps.findIndex((s) => s.id === progId)
									: steps.findIndex((s) => s.status === "running");
								if (idx >= 0) {
									steps[idx] = {
										...steps[idx],
										progressMessage: progMsg,
										progressCurrent: progCur,
										progressTotal: progTotal,
									};
									copy[i] = { ...copy[i], steps };
									return copy;
								}
							}
						}
						return prev;
					});
					break;
				}
				case "tool_result": {
					const toolId = (data.id as string) || "";
					const toolName = data.name as string;
					setItems((prev) => {
						const copy = [...prev];
						for (let i = copy.length - 1; i >= 0; i--) {
							if (copy[i].type === "step_group" && copy[i].steps) {
								const steps = [...copy[i].steps!];
								const idx = toolId
									? steps.findIndex((s) => s.id === toolId)
									: steps.findIndex(
											(s) => s.toolName === toolName && s.status === "running",
										);
								if (idx >= 0) {
									steps[idx] = {
										...steps[idx],
										status: (data.success as boolean) ? "done" : "error",
										success: data.success as boolean,
										summary: data.summary as string,
										data: data.data as Record<string, unknown>,
									};
									copy[i] = { ...copy[i], steps };
									return copy;
								}
							}
						}
						return prev;
					});
					if (data.success && data.data) {
						const d = data.data as Record<string, unknown>;
						if (d.html) {
							const artTitle = String(d.title || "Daily Brief");
							const artContent = String(d.html);
							setItems((prev) => [
								...prev,
								{
									id: `art_${Date.now()}`,
									type: "artifact" as const,
									content: "",
									artifactTitle: artTitle,
									artifactContent: artContent,
									artifactIsHtml: true,
									timestamp: new Date(),
								},
							]);
							if (isActive) setCanvas({ title: artTitle, markdown: artContent, isHtml: true });
						} else if (d.markdown) {
							const artTitle = String(d.title || "报告");
							const artContent = String(d.markdown);
							setItems((prev) => [
								...prev,
								{
									id: `art_${Date.now()}`,
									type: "artifact" as const,
									content: "",
									artifactTitle: artTitle,
									artifactContent: artContent,
									artifactIsHtml: false,
									timestamp: new Date(),
								},
							]);
							if (isActive) setCanvas({ title: artTitle, markdown: artContent });
						}
					}
					break;
				}
				case "action_confirm": {
					const pending = drainBufferFor(convId);
					const actionId = data.id as string;
					addPendingFor(convId, actionId);
					setItems((prev) => {
						const copy = [...prev];
						applyPendingText(copy, pending);
						return [
							...copy,
							{
								id,
								type: "action_confirm" as const,
								content: "",
								actionId,
								actionDescription: data.description as string,
								actionTool: data.tool as string,
								toolArgs: data.args as Record<string, unknown>,
								timestamp: new Date(),
							},
						];
					});
					setLoadingFor(convId, false);
					break;
				}
				case "action_result": {
					const arId = (data.id as string) || "";
					setItems((prev) => {
						const copy = [...prev];
						for (let i = copy.length - 1; i >= 0; i--) {
							if (copy[i].type === "step_group" && copy[i].steps) {
								const steps = [...copy[i].steps!];
								const running = steps.findIndex((s) => s.status === "running");
								if (running >= 0) {
									steps[running] = {
										...steps[running],
										status: (data.success as boolean) ? "done" : "error",
										success: data.success as boolean,
										summary: data.summary as string,
										data: data.data as Record<string, unknown>,
									};
									copy[i] = { ...copy[i], steps };
									return copy;
								}
							}
						}
						const last = copy[copy.length - 1];
						if (last && last.type === "step_group") {
							const steps = [...(last.steps || [])];
							steps.push({
								id: arId,
								status: ((data.success as boolean) ? "done" : "error") as "done" | "error",
								toolName: "操作执行",
								success: data.success as boolean,
								summary: data.summary as string,
								data: data.data as Record<string, unknown>,
							});
							copy[copy.length - 1] = { ...last, steps };
							return copy;
						}
						return [
							...prev,
							{
								id: `sg_${Date.now()}`,
								type: "step_group" as const,
								content: "",
								steps: [
									{
										id: arId,
										status: ((data.success as boolean) ? "done" : "error") as "done" | "error",
										toolName: "操作执行",
										success: data.success as boolean,
										summary: data.summary as string,
										data: data.data as Record<string, unknown>,
									},
								],
								timestamp: new Date(),
							},
						];
					});
					if (data.success && data.data) {
						const d = data.data as Record<string, unknown>;
						if (d.markdown) {
							const artTitle = String(d.title || "Wiki");
							const artContent = String(d.markdown);
							setItems((prev) => [
								...prev,
								{
									id: `art_${Date.now()}`,
									type: "artifact" as const,
									content: "",
									artifactTitle: artTitle,
									artifactContent: artContent,
									artifactIsHtml: false,
									timestamp: new Date(),
								},
							]);
							if (isActive) setCanvas({ title: artTitle, markdown: artContent });
						} else if (d.html) {
							const artTitle = String(d.title || "Daily Brief");
							const artContent = String(d.html);
							setItems((prev) => [
								...prev,
								{
									id: `art_${Date.now()}`,
									type: "artifact" as const,
									content: "",
									artifactTitle: artTitle,
									artifactContent: artContent,
									artifactIsHtml: true,
									timestamp: new Date(),
								},
							]);
							if (isActive) setCanvas({ title: artTitle, markdown: artContent, isHtml: true });
						}
					}
					break;
				}
				case "error": {
					const pending = drainBufferFor(convId);
					setItems((prev) => {
						const copy = [...prev];
						applyPendingText(copy, pending);
						return [
							...copy,
							{
								id,
								type: "error" as const,
								content: (data.message as string) || "未知错误",
								timestamp: new Date(),
							},
						];
					});
					break;
				}
				case "done": {
					const pending = drainBufferFor(convId);
					setItems((prev) => {
						const hasStreaming = prev.some(
							(it) => it.type === "assistant" && it.streaming,
						);
						if (hasStreaming) {
							return prev.map((item) =>
								item.type === "assistant" && item.streaming
									? { ...item, content: item.content + pending, streaming: false }
									: item,
							);
						}
						if (pending) {
							return [
								...prev,
								{
									id: `asst_done_${Date.now()}`,
									type: "assistant" as const,
									content: pending,
									streaming: false,
									timestamp: new Date(),
								},
							];
						}
						return prev;
					});
					setLoadingFor(convId, false);
					break;
				}
			}
		},
		[
			updateItems,
			scheduleFlushFor,
			drainBufferFor,
			addPendingFor,
			setLoadingFor,
		],
	);

	const startStream = useCallback(
		(
			convId: string,
			reader: ReadableStreamDefaultReader<Uint8Array>,
			signal?: AbortSignal,
		) => {
			parseSSEStream(
				reader,
				(event) => processSSE(convId, event),
				() => {
					// fallback: stream closed without "done"
					setLoadingByConv((all) => {
						if (!all[convId]) return all;
						const pending = drainBufferFor(convId);
						if (pending) {
							updateItems(convId, (prev) => {
								const hasStreaming = prev.some(
									(it) => it.type === "assistant" && it.streaming,
								);
								if (hasStreaming) {
									return prev.map((item) =>
										item.type === "assistant" && item.streaming
											? { ...item, content: item.content + pending, streaming: false }
											: item,
									);
								}
								return [
									...prev,
									{
										id: `asst_fallback_${Date.now()}`,
										type: "assistant" as const,
										content: pending,
										streaming: false,
										timestamp: new Date(),
									},
								];
							});
						}
						return { ...all, [convId]: false };
					});
				},
			);

			if (signal) {
				signal.addEventListener("abort", () => {
					reader.cancel().catch(() => {});
					setLoadingFor(convId, false);
				});
			}
		},
		[processSSE, drainBufferFor, updateItems, setLoadingFor],
	);

	/* ─── Public API ────────────────────────────────────────────────────── */

	const sendMessage = useCallback(
		async (text: string) => {
			const trimmed = text.trim();
			if (!trimmed) throw new Error("empty");

			let convId = activeIdRef.current;
			if (!convId) {
				convId = createConversation();
				loadedConvsRef.current.add(convId);
			}

			const isBusy =
				!!loadingByConv[convId] || (pendingByConv[convId]?.size ?? 0) > 0;
			if (isBusy) {
				// Only block when THIS conversation is busy — other conversations
				// are independent and can keep streaming in the background.
				throw new Error("conversation busy");
			}

			setLoadingFor(convId, true);
			const userItem: ChatItem = {
				id: `user_${Date.now()}`,
				type: "user" as const,
				content: trimmed,
				timestamp: new Date(),
			};
			updateItems(convId, (prev) => [...prev, userItem]);

			// build msg history from this conversation only
			const history = itemsByConvRef.current[convId] ?? [];
			const msgs: AgentMessage[] = [];
			for (const it of history) {
				if (it.type === "user") {
					msgs.push({ role: "user", content: it.content });
				} else if (it.type === "assistant") {
					msgs.push({ role: "assistant", content: it.content });
				} else if (it.type === "step_group" && it.steps) {
					const summaries = it.steps
						.filter((s) => s.status === "done" || s.status === "error")
						.map(
							(s) =>
								`[工具: ${s.toolName}] ${s.success ? "成功" : "失败"}: ${s.summary || ""}`,
						)
						.join("\n");
					if (summaries) {
						msgs.push({ role: "assistant", content: `执行了以下操作:\n${summaries}` });
					}
				} else if (it.type === "action_confirm") {
					msgs.push({
						role: "assistant",
						content: `[等待确认] ${it.actionDescription || it.actionTool || ""}`,
					});
				} else if (it.type === "artifact") {
					msgs.push({
						role: "assistant",
						content: `[已生成内容: ${it.artifactTitle || "未命名"}]\n${(it.artifactContent || "").slice(0, 500)}`,
					});
				} else if (it.type === "error") {
					msgs.push({ role: "assistant", content: `[错误: ${it.content}]` });
				}
			}
			msgs.push({ role: "user" as const, content: trimmed });

			try {
				const ac = new AbortController();
				abortByConv.current[convId] = ac;
				const resp = await agentApi.chat(msgs);
				if (!resp.body) {
					updateItems(convId, (p) => [
						...p,
						{
							id: `e_${Date.now()}`,
							type: "error" as const,
							content: "无响应流",
							timestamp: new Date(),
						},
					]);
					setLoadingFor(convId, false);
					return;
				}
				startStream(convId, resp.body.getReader(), ac.signal);
			} catch (err) {
				updateItems(convId, (p) => [
					...p,
					{
						id: `e_${Date.now()}`,
						type: "error" as const,
						content: err instanceof Error ? err.message : "请求失败",
						timestamp: new Date(),
					},
				]);
				setLoadingFor(convId, false);
			}
		},
		[
			loadingByConv,
			pendingByConv,
			createConversation,
			startStream,
			updateItems,
			setLoadingFor,
		],
	);

	const handleConfirm = useCallback(
		async (actionId: string) => {
			const convId = activeIdRef.current;
			if (!convId) return;
			setConfirmingFor(convId, actionId, true);
			removePendingFor(convId, actionId);
			cancelStreamFor(convId);
			setLoadingFor(convId, true);
			try {
				const ac = new AbortController();
				abortByConv.current[convId] = ac;
				const resp = await agentApi.confirm(actionId);
				if (resp.body) startStream(convId, resp.body.getReader(), ac.signal);
				else setLoadingFor(convId, false);
			} catch (err) {
				updateItems(convId, (p) => [
					...p,
					{
						id: `e_${Date.now()}`,
						type: "error" as const,
						content: err instanceof Error ? err.message : "确认失败",
						timestamp: new Date(),
					},
				]);
				setLoadingFor(convId, false);
			} finally {
				setConfirmingFor(convId, actionId, false);
			}
		},
		[
			startStream,
			cancelStreamFor,
			removePendingFor,
			setConfirmingFor,
			setLoadingFor,
			updateItems,
		],
	);

	const handleReject = useCallback(
		async (actionId: string) => {
			const convId = activeIdRef.current;
			if (!convId) return;
			removePendingFor(convId, actionId);
			cancelStreamFor(convId);
			setLoadingFor(convId, true);
			try {
				const ac = new AbortController();
				abortByConv.current[convId] = ac;
				const resp = await agentApi.reject(actionId);
				if (resp.body) startStream(convId, resp.body.getReader(), ac.signal);
				else setLoadingFor(convId, false);
			} catch (err) {
				updateItems(convId, (p) => [
					...p,
					{
						id: `e_${Date.now()}`,
						type: "error" as const,
						content: err instanceof Error ? err.message : "拒绝操作失败",
						timestamp: new Date(),
					},
				]);
				setLoadingFor(convId, false);
			}
		},
		[startStream, cancelStreamFor, removePendingFor, setLoadingFor, updateItems],
	);

	const stopGeneration = useCallback(() => {
		const convId = activeIdRef.current;
		if (!convId) return;
		cancelStreamFor(convId);
		const pending = drainBufferFor(convId);
		setLoadingFor(convId, false);
		updateItems(convId, (prev) =>
			prev.map((item) =>
				item.type === "assistant" && item.streaming
					? { ...item, content: item.content + pending, streaming: false }
					: item,
			),
		);
	}, [cancelStreamFor, drainBufferFor, setLoadingFor, updateItems]);

	/* ─── Active-conversation projection ────────────────────────────────── */
	const items = activeId ? itemsByConv[activeId] ?? EMPTY_ITEMS : EMPTY_ITEMS;
	const loading = activeId ? !!loadingByConv[activeId] : false;
	const pendingActions = activeId
		? pendingByConv[activeId] ?? EMPTY_SET
		: EMPTY_SET;
	const confirmingActions = activeId
		? confirmingByConv[activeId] ?? EMPTY_SET
		: EMPTY_SET;
	const hasPendingConfirm = pendingActions.size > 0;

	const value: AgentSessionCtx = useMemo(
		() => ({
			items,
			loading,
			pendingActions,
			confirmingActions,
			canvas,
			hasPendingConfirm,
			setCanvas,
			sendMessage,
			handleConfirm,
			handleReject,
			stopGeneration,
		}),
		[
			items,
			loading,
			pendingActions,
			confirmingActions,
			canvas,
			hasPendingConfirm,
			sendMessage,
			handleConfirm,
			handleReject,
			stopGeneration,
		],
	);

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgentSession(): AgentSessionCtx {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error("useAgentSession must be inside AgentSessionProvider");
	return ctx;
}
