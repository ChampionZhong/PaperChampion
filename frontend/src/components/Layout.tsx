/**
 * Layout — app shell.
 *
 * Wraps the route Outlet with Conversation / AgentSession / GlobalTask /
 * Sidebar providers, renders the Sidebar, and reserves the right amount of
 * left margin on the main canvas based on the Sidebar collapse state.
 *
 * On the Agent route the main canvas takes the full viewport height so the
 * chat input remains anchored; other routes get a centered container with
 * comfortable padding.
 *
 * @author Bamzc
 */
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import GlobalTaskBar from "./GlobalTaskBar";
import { AgentSessionProvider } from "@/contexts/AgentSessionContext";
import { ConversationProvider } from "@/contexts/ConversationContext";
import { GlobalTaskProvider } from "@/contexts/GlobalTaskContext";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

function ShellInner() {
	const { collapsed } = useSidebar();
	const { pathname } = useLocation();
	const isAgentRoute = pathname === "/";

	return (
		<div className="min-h-screen bg-page text-ink">
			<Sidebar />
			<GlobalTaskBar />
			<main
				className={cn(
					"min-h-screen transition-[margin-left] duration-normal ease-standard",
					collapsed ? "lg:ml-16" : "lg:ml-[260px]",
				)}
			>
				{isAgentRoute ? (
					<div className="flex h-screen flex-col">
						<Outlet />
					</div>
				) : (
					<div className="pt-14 lg:pt-0">
						<div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
							<Outlet />
						</div>
					</div>
				)}
			</main>
		</div>
	);
}

export default function Layout() {
	return (
		<SidebarProvider>
			<ConversationProvider>
				<AgentSessionProvider>
					<GlobalTaskProvider>
						<ShellInner />
					</GlobalTaskProvider>
				</AgentSessionProvider>
			</ConversationProvider>
		</SidebarProvider>
	);
}
