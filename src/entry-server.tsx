import { renderToString } from "react-dom/server";
import { App } from "@/App";
import { getRoute, staticRoutes } from "@/routes";

export interface RenderResult {
	html: string;
	title: string;
	description: string;
	status: number;
	noIndex: boolean;
}

export function render(path: string): RenderResult {
	const route = getRoute(path);

	return {
		html: renderToString(<App path={path} />),
		title: route.title,
		description: route.description,
		status: route.status ?? 200,
		noIndex: route.noIndex ?? false,
	};
}

export function getStaticRoutes() {
	return staticRoutes.map(({ path }) => ({ path }));
}
