import { useEffect } from "react";
import type { AnalyticsBridgeProps } from "./block-types";
import {
	getRuntimeTrafficProperties,
	isRuntimeConfigured,
	postRuntimeEvent,
	runtimeConfig,
} from "./runtime-client";

export function AnalyticsBridge(props: AnalyticsBridgeProps) {
	useEffect(() => {
		if (!props.enabledEvents.includes("page_view") || !isRuntimeConfigured()) {
			return;
		}

		const properties = {
			...(props.funnelStepId ? { funnelStepId: props.funnelStepId } : {}),
			...(typeof props.funnelRevision === "number"
				? { funnelRevision: props.funnelRevision }
				: {}),
			...(props.routePath ? { routePath: props.routePath } : {}),
			...getRuntimeTrafficProperties(),
		};
		const hasProperties = Object.keys(properties).length > 0;

		void postRuntimeEvent({
			websiteId: runtimeConfig.websiteId,
			runtimeToken: runtimeConfig.runtimeToken,
			path: "/events",
			body: {
				event: "page_view",
				path: props.routePath ?? window.location.pathname,
				...(props.funnelStepId ? { blockId: props.funnelStepId } : {}),
				...(hasProperties ? { properties } : {}),
			},
		}).catch(() => undefined);
	}, [
		props.enabledEvents,
		props.funnelRevision,
		props.funnelStepId,
		props.routePath,
	]);

	return null;
}
