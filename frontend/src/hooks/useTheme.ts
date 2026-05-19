/**
 * useTheme — light / dark theme toggle persisted to localStorage.
 *
 * @author Bamzc
 */
import { useEffect, useState } from "react";

const STORAGE_KEY = "theme";

function initial(): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(STORAGE_KEY) === "dark";
}

export function useTheme() {
	const [dark, setDark] = useState<boolean>(initial);

	useEffect(() => {
		const root = document.documentElement;
		if (dark) {
			root.classList.add("dark");
			localStorage.setItem(STORAGE_KEY, "dark");
		} else {
			root.classList.remove("dark");
			localStorage.setItem(STORAGE_KEY, "light");
		}
	}, [dark]);

	const toggle = () => setDark((d) => !d);
	return { dark, toggle, setDark } as const;
}
