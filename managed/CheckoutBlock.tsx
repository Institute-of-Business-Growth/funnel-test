import { useState } from "react";
import type { CheckoutBlockProps } from "./block-types";
import {
	getRuntimeUtm,
	postRuntimeEvent,
	runtimeConfig,
} from "./runtime-client";

export function CheckoutBlock(props: CheckoutBlockProps) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [includeOrderBump, setIncludeOrderBump] = useState(false);

	async function startCheckout() {
		setPending(true);
		setError(null);

		try {
			const sourcePath = props.routePath ?? window.location.pathname;
			const utm = getRuntimeUtm();
			const result = await postRuntimeEvent({
				websiteId: runtimeConfig.websiteId,
				runtimeToken: runtimeConfig.runtimeToken,
				path: "/checkout/start",
				body: {
					offerId: props.offerId,
					successPath: props.successPath,
					sourcePath,
					...(props.orderBumpOfferId
						? {
								orderBumpAccepted: includeOrderBump,
								orderBumpOfferId: props.orderBumpOfferId,
							}
						: {}),
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
				return;
			}

			throw new Error("Checkout URL missing");
		} catch {
			setError("Unable to start checkout. Please try again.");
		} finally {
			setPending(false);
		}
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
				{props.orderBumpOfferId ? (
					<label className="flex items-start gap-3 rounded-md border border-border p-4">
						<input
							checked={includeOrderBump}
							className="mt-1"
							onChange={(event) => setIncludeOrderBump(event.target.checked)}
							type="checkbox"
						/>
						<span>
							<strong>{props.orderBumpLabel ?? "Add this offer"}</strong>
							{props.orderBumpDescription ? (
								<span className="mt-1 block text-sm text-muted-foreground">
									{props.orderBumpDescription}
								</span>
							) : null}
						</span>
					</label>
				) : null}
				<button
					className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
					disabled={pending}
					onClick={startCheckout}
					type="button"
				>
					{pending ? "Opening checkout..." : (props.buttonText ?? "Checkout")}
				</button>
				{error ? (
					<p className="text-sm text-destructive" role="alert">
						{error}
					</p>
				) : null}
			</div>
		</section>
	);
}
