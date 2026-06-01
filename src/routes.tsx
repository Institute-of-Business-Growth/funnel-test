import type { ComponentType } from "react";
import { siteConfig } from "@/lib/site";
import { HomePage } from "@/pages/home-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { ThankYouPage } from "@/pages/thank-you-page";

export interface StaticRoute {
	path: string;
	title: string;
	description: string;
	Component: ComponentType;
	status?: number;
	noIndex?: boolean;
}

export const staticRoutes = [
	{
		path: "/",
		title: siteConfig.name,
		description: siteConfig.description,
		Component: HomePage,
	},
	{
		path: "/404",
		title: `Page not found - ${siteConfig.name}`,
		description: "The requested page could not be found.",
		Component: NotFoundPage,
		status: 404,
		noIndex: true,
	},
	{
		path: "/thank-you",
		title: `Thank you - ${siteConfig.name}`,
		description: "Confirmation page for the DFY website funnel.",
		Component: ThankYouPage,
	},
] satisfies StaticRoute[];

export function normalizePath(path: string) {
	const pathname = path.split("?")[0]?.split("#")[0] || "/";
	const normalized =
		pathname.endsWith("/") && pathname !== "/"
			? pathname.slice(0, -1)
			: pathname;

	return normalized || "/";
}

export function getRoute(path: string): StaticRoute {
	const normalized = normalizePath(path);
	return (
		staticRoutes.find((route) => route.path === normalized) ?? staticRoutes[1]
	);
}
