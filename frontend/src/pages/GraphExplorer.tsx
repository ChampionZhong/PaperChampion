/**
 * GraphExplorer — knowledge graph hub.
 *
 * Three panels: global overview / citation analysis / domain insight.
 *
 * @author Bamzc
 */
import { useState } from "react";
import { Compass, Network, TrendingUp } from "lucide-react";
import OverviewPanel from "@/components/graph/OverviewPanel";
import CitationPanel from "@/components/graph/CitationPanel";
import InsightPanel from "@/components/graph/InsightPanel";
import { Dot, Tabs } from "@/components/ui";

const TAB_DEFS = [
	{ id: "overview", label: "全局概览", icon: Compass },
	{ id: "citation", label: "引文分析", icon: Network },
	{ id: "insight", label: "领域洞察", icon: TrendingUp },
] as const;

type TabId = (typeof TAB_DEFS)[number]["id"];

export default function GraphExplorer() {
	const [activeTab, setActiveTab] = useState<TabId>("overview");

	return (
		<div className="animate-fade-in space-y-6">
			<div className="flex items-center gap-2.5 pb-2">
				<Dot module="graph" size={6} />
				<div>
					<h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-ink">
						知识图谱
					</h1>
					<p className="mt-2 text-[12.5px] text-ink-secondary">
						探索引用关系、领域时间线和知识脉络
					</p>
				</div>
			</div>

			<Tabs
				tabs={TAB_DEFS.map((t) => ({
					id: t.id,
					label: (
						<span className="inline-flex items-center gap-1.5">
							<t.icon className="h-3.5 w-3.5" />
							{t.label}
						</span>
					),
				}))}
				active={activeTab}
				onChange={(id) => setActiveTab(id as TabId)}
				variant="underline"
			/>

			{activeTab === "overview" && <OverviewPanel />}
			{activeTab === "citation" && <CitationPanel />}
			{activeTab === "insight" && <InsightPanel />}
		</div>
	);
}
