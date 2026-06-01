"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
	theme: Theme;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: Theme) => void;
}

interface ThemeProviderProps {
	children: ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: string | null): value is Theme {
	return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ResolvedTheme {
	if (typeof window === "undefined") {
		return "light";
	}

	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function getInitialTheme(defaultTheme: Theme, storageKey: string): Theme {
	if (typeof window === "undefined") {
		return defaultTheme;
	}

	const storedTheme = window.localStorage.getItem(storageKey);
	return isTheme(storedTheme) ? storedTheme : defaultTheme;
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "codeforge-theme",
}: ThemeProviderProps) {
	const [theme, setThemeState] = useState<Theme>(() =>
		getInitialTheme(defaultTheme, storageKey),
	);
	const [resolvedTheme, setResolvedTheme] =
		useState<ResolvedTheme>(getSystemTheme);

	useEffect(() => {
		const storedTheme = window.localStorage.getItem(storageKey);
		if (isTheme(storedTheme)) {
			setThemeState(storedTheme);
		}
	}, [storageKey]);

	useEffect(() => {
		const applyTheme = () => {
			const nextResolvedTheme = theme === "system" ? getSystemTheme() : theme;
			setResolvedTheme(nextResolvedTheme);
			document.documentElement.classList.toggle(
				"dark",
				nextResolvedTheme === "dark",
			);
		};

		applyTheme();

		if (theme !== "system") {
			return;
		}

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		media.addEventListener("change", applyTheme);
		return () => media.removeEventListener("change", applyTheme);
	}, [theme]);

	const setTheme = useCallback(
		(nextTheme: Theme) => {
			setThemeState(nextTheme);
			window.localStorage.setItem(storageKey, nextTheme);
		},
		[storageKey],
	);

	const value = useMemo(
		() => ({ theme, resolvedTheme, setTheme }),
		[theme, resolvedTheme, setTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme() {
	const value = useContext(ThemeContext);
	if (!value) {
		throw new Error("useTheme must be used within ThemeProvider");
	}

	return value;
}
