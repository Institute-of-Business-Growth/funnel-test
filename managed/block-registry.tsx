import type { ComponentType } from "react";
import { AnalyticsBridge } from "./AnalyticsBridge";
import type { ManagedBlock } from "./block-schemas";
import { CheckoutBlock } from "./CheckoutBlock";
import { LeadFormBlock } from "./LeadFormBlock";
import { OfferDisplayBlock } from "./OfferDisplayBlock";
import { UpsellBlock } from "./UpsellBlock";
import { VideoEmbedBlock } from "./VideoEmbedBlock";

type ManagedComponent = ComponentType<Record<string, unknown>>;

export const managedBlockRegistry: Record<
	ManagedBlock["blockType"],
	ManagedComponent
> = {
	CheckoutBlock: CheckoutBlock as ManagedComponent,
	UpsellBlock: UpsellBlock as ManagedComponent,
	LeadFormBlock: LeadFormBlock as ManagedComponent,
	OfferDisplayBlock: OfferDisplayBlock as ManagedComponent,
	VideoEmbedBlock: VideoEmbedBlock as ManagedComponent,
	AnalyticsBridge: AnalyticsBridge as ManagedComponent,
};
