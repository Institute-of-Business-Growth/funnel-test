import { useEffect, useState } from "react";
import type { OfferDisplayBlockProps } from "./block-types";
import { getRuntimeData, runtimeConfig } from "./runtime-client";

type RuntimeOffer = {
	displayName?: string;
	productName?: string;
	description?: string | null;
	headline?: string | null;
	imageUrl?: string | null;
	price?: {
		currency?: string;
		initialAmountMinor?: number | null;
		renewalAmountMinor?: number | null;
		scheduleType?: string | null;
	} | null;
	checkoutAvailable?: boolean;
};

function formatPrice(price: RuntimeOffer["price"]) {
	if (!(price?.currency && typeof price.initialAmountMinor === "number")) {
		return null;
	}

	return new Intl.NumberFormat(undefined, {
		currency: price.currency.toUpperCase(),
		style: "currency",
	}).format(price.initialAmountMinor / 100);
}

export function OfferDisplayBlock(props: OfferDisplayBlockProps) {
	const [offer, setOffer] = useState<RuntimeOffer | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setError(false);

		getRuntimeData({
			websiteId: runtimeConfig.websiteId,
			runtimeToken: runtimeConfig.runtimeToken,
			path: `/offers/${props.offerId}`,
		})
			.then((result) => {
				if (!cancelled) {
					setOffer(result.offer as RuntimeOffer);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setError(true);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [props.offerId]);

	if (error) {
		return null;
	}

	const price = formatPrice(offer?.price);
	const variant = props.variant ?? "card";
	const compact = variant === "compact";

	return (
		<section className={compact ? "py-4" : "px-4 py-10 md:px-8"}>
			<div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm">
				{offer?.imageUrl && !compact ? (
					<img
						alt={offer.displayName ?? offer.productName ?? "Offer"}
						className="mb-5 aspect-video w-full rounded-md object-cover"
						src={offer.imageUrl}
					/>
				) : null}
				<p className="text-sm font-medium text-primary">
					{offer?.productName ?? "Offer"}
				</p>
				<h2 className="mt-2 text-2xl font-semibold tracking-tight">
					{props.headline ?? offer?.headline ?? offer?.displayName ?? "Offer"}
				</h2>
				{props.description ?? offer?.description ? (
					<p className="mt-3 text-muted-foreground">
						{props.description ?? offer?.description}
					</p>
				) : null}
				{price ? <p className="mt-4 text-lg font-semibold">{price}</p> : null}
				{props.ctaText ? (
					<p className="mt-4 text-sm text-muted-foreground">{props.ctaText}</p>
				) : null}
			</div>
		</section>
	);
}
