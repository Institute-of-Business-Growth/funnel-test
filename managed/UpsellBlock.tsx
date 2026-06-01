import { type MouseEvent, useState } from "react";
import type { UpsellBlockProps } from "./block-types";
import { getRuntimeUtm, postRuntimeEvent, runtimeConfig } from "./runtime-client";

export function UpsellBlock(props: UpsellBlockProps) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function acceptUpsell() {
		setPending(true);
		setError(null);

		try {
			const searchParams = new URLSearchParams(window.location.search);
			const buyerToken = searchParams.get("buyerToken");
			const sourcePath = props.routePath ?? window.location.pathname;
			const utm = getRuntimeUtm();
			const result = await postRuntimeEvent({
				websiteId: runtimeConfig.websiteId,
				runtimeToken: runtimeConfig.runtimeToken,
				path: "/upsell/start",
				body: {
					buyerToken,
					offerId: props.offerId,
					sourcePath,
					...(utm ? { utm } : {}),
					...(props.funnelStepId ? { funnelStepId: props.funnelStepId } : {}),
					...(typeof props.funnelRevision === "number"
						? { funnelRevision: props.funnelRevision }
						: {}),
					...(props.routePath ? { routePath: props.routePath } : {}),
				},
			});

			const redirectUrl = result.checkoutUrl;
			if (typeof redirectUrl === "string") {
				window.location.href = redirectUrl;
			}
		} catch {
			setError("Unable to start upsell. Please try again.");
		} finally {
			setPending(false);
		}
	}

	async function declineUpsell(event: MouseEvent<HTMLAnchorElement>) {
		const declineHref = props.declineHref;
		if (!declineHref) {
			return;
		}

		event.preventDefault();
		try {
			const searchParams = new URLSearchParams(window.location.search);
			const buyerToken = searchParams.get("buyerToken");
			const sourcePath = props.routePath ?? window.location.pathname;
			const utm = getRuntimeUtm();
			const result = await postRuntimeEvent({
				websiteId: runtimeConfig.websiteId,
				runtimeToken: runtimeConfig.runtimeToken,
				path: "/upsell/decline",
				body: {
					buyerToken,
					offerId: props.offerId,
					sourcePath,
					...(utm ? { utm } : {}),
					...(props.funnelStepId ? { funnelStepId: props.funnelStepId } : {}),
					...(typeof props.funnelRevision === "number"
						? { funnelRevision: props.funnelRevision }
						: {}),
					...(props.routePath ? { routePath: props.routePath } : {}),
				},
			});

			const nextAction = result.nextAction;
			if (
				typeof nextAction === "object" &&
				nextAction !== null &&
				"type" in nextAction &&
				"path" in nextAction &&
				nextAction.type === "redirect" &&
				typeof nextAction.path === "string"
			) {
				window.location.href = nextAction.path;
				return;
			}
		} catch {
			// Do not block funnel progression when runtime tracking is unavailable.
		}
		window.location.href = declineHref;
	}

	return (
		<section className="px-4 py-12 md:px-8">
			<div className="mx-auto grid max-w-2xl gap-5 rounded-lg border border-border bg-card p-6 shadow-sm">
				{props.headline ? (
					<h2 className="text-2xl font-semibold tracking-tight">
						{props.headline}
					</h2>
				) : null}
				{props.description ? (
					<p className="text-muted-foreground">{props.description}</p>
				) : null}
				<button
					className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
					disabled={pending}
					onClick={acceptUpsell}
					type="button"
				>
					{pending ? "Processing..." : (props.acceptText ?? "Add this offer")}
				</button>
				{props.declineHref ? (
					<a
						className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
						href={props.declineHref}
						onClick={declineUpsell}
					>
						No thanks
					</a>
				) : null}
				{error ? (
					<p className="text-sm text-destructive" role="alert">
						{error}
					</p>
				) : null}
			</div>
		</section>
	);
}
