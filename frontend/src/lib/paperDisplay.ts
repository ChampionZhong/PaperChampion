type AbstractDisplayPaper = {
	read_status?: string;
	abstract?: string | null;
	abstract_zh?: string | null;
};

export function getExpandedAbstractText(paper: AbstractDisplayPaper): string {
	const originalAbstract = paper.abstract?.trim() ?? "";
	const translatedAbstract = paper.abstract_zh?.trim() ?? "";
	const hasSkim = paper.read_status === "skimmed" || paper.read_status === "deep_read";

	if (hasSkim && translatedAbstract) {
		return translatedAbstract;
	}

	return originalAbstract;
}
