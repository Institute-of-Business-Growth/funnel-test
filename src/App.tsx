import { ThemeProvider } from "@/components/theme-provider";
import { getRoute } from "@/routes";

export interface AppProps {
	path?: string;
}

function getCurrentPath() {
	if (typeof window === "undefined") {
		return "/";
	}

	return window.location.pathname;
}

export function App({ path = getCurrentPath() }: AppProps) {
	const route = getRoute(path);
	const Page = route.Component;

	return (
		<ThemeProvider defaultTheme="light">
			<div className="min-h-screen bg-background">
				<Page />
			</div>
		</ThemeProvider>
	);
}
