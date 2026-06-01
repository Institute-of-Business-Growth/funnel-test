"use client";

import { useCallback, useEffect, useRef } from "react";
import { resolveManagedVideoEmbedUrl } from "./block-schemas";
import type { VideoEmbedBlockProps } from "./block-types";
import { postRuntimeEvent, runtimeConfig } from "./runtime-client";

type VideoTrackingEvent = NonNullable<
	VideoEmbedBlockProps["trackingEvents"]
>[number];

const delayedVideoTrackingEvents: Partial<Record<VideoTrackingEvent, number>> = {
	video_progress: 30_000,
	video_complete: 120_000,
};

export function VideoEmbedBlock(props: VideoEmbedBlockProps) {
	const sentEventsRef = useRef<Set<VideoTrackingEvent>>(new Set());
	const scheduledEventsRef = useRef<Set<VideoTrackingEvent>>(new Set());
	const timerIdsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
	const [width, height] =
		props.aspectRatio === "4:3"
			? [4, 3]
			: props.aspectRatio === "1:1"
				? [1, 1]
				: [16, 9];
	const autoplay = props.autoplay ? "?autoplay=1&muted=1" : "";
	const src = `${resolveManagedVideoEmbedUrl(props) ?? "about:blank"}${autoplay}`;

	const postVideoEvent = useCallback(
		(event: VideoTrackingEvent) => {
			if (
				!props.trackingEvents?.includes(event) ||
				sentEventsRef.current.has(event)
			) {
				return;
			}
			sentEventsRef.current.add(event);

			const properties = {
				provider: props.provider,
				...(props.title ? { title: props.title } : {}),
			};

			void postRuntimeEvent({
				websiteId: runtimeConfig.websiteId,
				runtimeToken: runtimeConfig.runtimeToken,
				path: "/events",
				body: {
					blockId: props.videoId,
					blockType: "VideoEmbedBlock",
					event,
					path: window.location.pathname,
					properties,
				},
			}).catch(() => {
				sentEventsRef.current.delete(event);
			});
		},
		[props.provider, props.title, props.trackingEvents, props.videoId],
	);

	const trackVideoInteraction = useCallback(() => {
		postVideoEvent("video_play");

		for (const event of props.trackingEvents ?? []) {
			const delay = delayedVideoTrackingEvents[event];
			if (
				!delay ||
				sentEventsRef.current.has(event) ||
				scheduledEventsRef.current.has(event)
			) {
				continue;
			}
			scheduledEventsRef.current.add(event);
			timerIdsRef.current.push(
				setTimeout(() => {
					scheduledEventsRef.current.delete(event);
					postVideoEvent(event);
				}, delay),
			);
		}
	}, [postVideoEvent, props.trackingEvents]);

	useEffect(() => {
		return () => {
			for (const timerId of timerIdsRef.current) {
				clearTimeout(timerId);
			}
			timerIdsRef.current = [];
			scheduledEventsRef.current.clear();
			sentEventsRef.current.clear();
		};
	}, [props.videoId]);

	return (
		<section className="px-4 py-12 md:px-8">
			<div
				className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-border bg-card shadow-sm"
				onFocusCapture={trackVideoInteraction}
				onPointerDownCapture={trackVideoInteraction}
				style={{ aspectRatio: `${width} / ${height}` }}
			>
				<iframe
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
					allowFullScreen
					className="h-full w-full border-0"
					src={src}
					title={props.title ?? "Video"}
				/>
			</div>
		</section>
	);
}
