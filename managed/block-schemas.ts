export const allowedManagedBlockSlots = [
	"main",
	"hero",
	"content",
	"pricing",
	"checkout",
	"upsell",
	"post-purchase",
	"footer",
	"contact",
	"analytics",
] as const;

export type ManagedSlot = (typeof allowedManagedBlockSlots)[number];

export type FunnelTrackingProps = {
	funnelStepId?: string;
	funnelRevision?: number;
	routePath?: string;
};

export type CheckoutBlockProps = FunnelTrackingProps & {
	offerId: string;
	orderBumpOfferId?: string;
	orderBumpLabel?: string;
	orderBumpDescription?: string;
	headline?: string;
	description?: string;
	buttonText?: string;
	variant?: "button" | "card" | "inline";
	successPath?: string;
};

export type UpsellBlockProps = FunnelTrackingProps & {
	offerId: string;
	headline?: string;
	description?: string;
	acceptText?: string;
	declineHref?: string;
};

export type CustomLeadField = {
	id: string;
	label: string;
	type: "text" | "textarea" | "select";
	options?: string[];
};

export type LeadFormBlockProps = FunnelTrackingProps & {
	formId: string;
	title?: string;
	fields: Array<"name" | "email" | "phone" | CustomLeadField>;
	submitText?: string;
	successMessage?: string;
};

export type VideoEmbedBlockProps = {
	provider: "youtube" | "vimeo" | "wistia" | "loom";
	videoId: string;
	title?: string;
	aspectRatio?: "16:9" | "4:3" | "1:1";
	autoplay?: boolean;
	trackingEvents?: Array<"video_play" | "video_progress" | "video_complete">;
};

export type OfferDisplayBlockProps = FunnelTrackingProps & {
	offerId: string;
	headline?: string;
	description?: string;
	ctaText?: string;
	variant?: "card" | "inline" | "compact";
};

export type AnalyticsBridgeProps = FunnelTrackingProps & {
	enabledEvents: Array<
		| "page_view"
		| "checkout_started"
		| "lead_submitted"
		| "purchase"
		| "upsell_declined"
	>;
};

export type ManagedBlock =
	| { blockType: "CheckoutBlock"; props: CheckoutBlockProps }
	| { blockType: "UpsellBlock"; props: UpsellBlockProps }
	| { blockType: "LeadFormBlock"; props: LeadFormBlockProps }
	| { blockType: "OfferDisplayBlock"; props: OfferDisplayBlockProps }
	| { blockType: "VideoEmbedBlock"; props: VideoEmbedBlockProps }
	| { blockType: "AnalyticsBridge"; props: AnalyticsBridgeProps };

export type ManagedPageDocument = {
	schemaVersion: 1;
	registryVersion: string;
	slots: Partial<Record<ManagedSlot, ManagedBlock[]>>;
};

type SafeParseResult<T> =
	| { success: true; data: T }
	| {
			success: false;
			error: {
				issues: Array<{ message: string; path: Array<string | number> }>;
			};
	  };

const safeIdPattern = /^[A-Za-z0-9_-]+$/;
const internalPathPattern = /^\/(?!\/)/;

const allowedSlotsByBlockType = {
	CheckoutBlock: ["main", "pricing", "checkout"],
	UpsellBlock: ["main", "upsell", "post-purchase"],
	LeadFormBlock: ["main", "hero", "contact", "footer", "content"],
	OfferDisplayBlock: ["main", "hero", "content", "pricing"],
	VideoEmbedBlock: ["main", "hero", "content"],
	AnalyticsBridge: ["main", "analytics"],
} as const satisfies Record<ManagedBlock["blockType"], readonly ManagedSlot[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSafeId(value: unknown) {
	return (
		typeof value === "string" &&
		value.trim().length > 0 &&
		value.length <= 128 &&
		safeIdPattern.test(value)
	);
}

function isInternalPath(value: unknown) {
	return (
		typeof value === "string" &&
		value.trim().length > 0 &&
		value.length <= 2048 &&
		internalPathPattern.test(value)
	);
}

function isShortText(value: unknown) {
	return typeof value === "string" && value.trim().length <= 240;
}

function isLongText(value: unknown) {
	return typeof value === "string" && value.trim().length <= 1000;
}

function addIssue(issues: string[], path: string, message: string) {
	issues.push(`${path}: ${message}`);
}

function rejectUnknownProps(
	props: Record<string, unknown>,
	allowed: readonly string[],
	issues: string[],
	path: string,
) {
	const allowedSet = new Set(allowed);
	for (const key of Object.keys(props)) {
		if (!allowedSet.has(key)) {
			addIssue(issues, `${path}.${key}`, "Unknown property");
		}
	}
}

function validateOptionalTextProps(
	props: Record<string, unknown>,
	keys: readonly string[],
	issues: string[],
	path: string,
	max: "short" | "long",
) {
	const validate = max === "short" ? isShortText : isLongText;
	for (const key of keys) {
		if (props[key] !== undefined && !validate(props[key])) {
			addIssue(issues, `${path}.${key}`, "Invalid text value");
		}
	}
}

function validateTrackingProps(
	props: Record<string, unknown>,
	issues: string[],
	path: string,
) {
	if (props.funnelStepId !== undefined && !isSafeId(props.funnelStepId)) {
		addIssue(issues, `${path}.funnelStepId`, "Invalid funnel step id");
	}

	if (
		props.funnelRevision !== undefined &&
		!(
			typeof props.funnelRevision === "number" &&
			Number.isInteger(props.funnelRevision) &&
			props.funnelRevision >= 0
		)
	) {
		addIssue(issues, `${path}.funnelRevision`, "Invalid funnel revision");
	}

	if (props.routePath !== undefined && !isInternalPath(props.routePath)) {
		addIssue(issues, `${path}.routePath`, "Invalid route path");
	}
}

function validateCheckoutProps(
	props: Record<string, unknown>,
	issues: string[],
	path: string,
) {
	rejectUnknownProps(
		props,
		[
			"offerId",
			"orderBumpOfferId",
			"orderBumpLabel",
			"orderBumpDescription",
			"headline",
			"description",
			"buttonText",
			"variant",
			"successPath",
			"funnelStepId",
			"funnelRevision",
			"routePath",
		],
		issues,
		path,
	);

	if (!isSafeId(props.offerId)) {
		addIssue(issues, `${path}.offerId`, "offerId is required");
	}
	if (
		props.orderBumpOfferId !== undefined &&
		!isSafeId(props.orderBumpOfferId)
	) {
		addIssue(issues, `${path}.orderBumpOfferId`, "Invalid order bump offer id");
	}
	if (
		props.variant !== undefined &&
		!["button", "card", "inline"].includes(String(props.variant))
	) {
		addIssue(issues, `${path}.variant`, "Invalid checkout variant");
	}
	if (props.successPath !== undefined && !isInternalPath(props.successPath)) {
		addIssue(issues, `${path}.successPath`, "Invalid success path");
	}

	validateOptionalTextProps(
		props,
		["orderBumpLabel", "headline", "buttonText"],
		issues,
		path,
		"short",
	);
	validateOptionalTextProps(
		props,
		["orderBumpDescription", "description"],
		issues,
		path,
		"long",
	);
	validateTrackingProps(props, issues, path);
}

function validateUpsellProps(
	props: Record<string, unknown>,
	issues: string[],
	path: string,
) {
	rejectUnknownProps(
		props,
		[
			"offerId",
			"headline",
			"description",
			"acceptText",
			"declineHref",
			"funnelStepId",
			"funnelRevision",
			"routePath",
		],
		issues,
		path,
	);

	if (!isSafeId(props.offerId)) {
		addIssue(issues, `${path}.offerId`, "offerId is required");
	}
	if (props.declineHref !== undefined && !isInternalPath(props.declineHref)) {
		addIssue(issues, `${path}.declineHref`, "Invalid decline href");
	}

	validateOptionalTextProps(
		props,
		["headline", "acceptText"],
		issues,
		path,
		"short",
	);
	validateOptionalTextProps(props, ["description"], issues, path, "long");
	validateTrackingProps(props, issues, path);
}

function validateLeadField(field: unknown, issues: string[], path: string) {
	if (["name", "email", "phone"].includes(String(field))) {
		return;
	}

	if (!isRecord(field)) {
		addIssue(issues, path, "Invalid lead field");
		return;
	}

	rejectUnknownProps(field, ["id", "label", "type", "options"], issues, path);
	if (!isSafeId(field.id)) {
		addIssue(issues, `${path}.id`, "Invalid lead field id");
	}
	if (!isShortText(field.label)) {
		addIssue(issues, `${path}.label`, "Invalid lead field label");
	}
	if (!["text", "textarea", "select"].includes(String(field.type))) {
		addIssue(issues, `${path}.type`, "Invalid lead field type");
	}
	if (field.type === "select") {
		if (!Array.isArray(field.options) || field.options.length === 0) {
			addIssue(issues, `${path}.options`, "Select fields require options");
		}
	}
	if (field.options !== undefined) {
		if (!Array.isArray(field.options) || field.options.length > 50) {
			addIssue(issues, `${path}.options`, "Invalid field options");
			return;
		}
		for (const [index, option] of field.options.entries()) {
			if (!isShortText(option) || option.trim().length === 0) {
				addIssue(issues, `${path}.options.${index}`, "Invalid option");
			}
		}
	}
}

function validateLeadFormProps(
	props: Record<string, unknown>,
	issues: string[],
	path: string,
) {
	rejectUnknownProps(
		props,
		[
			"formId",
			"title",
			"fields",
			"submitText",
			"successMessage",
			"funnelStepId",
			"funnelRevision",
			"routePath",
		],
		issues,
		path,
	);

	if (!isSafeId(props.formId)) {
		addIssue(issues, `${path}.formId`, "formId is required");
	}
	if (!Array.isArray(props.fields) || props.fields.length === 0) {
		addIssue(issues, `${path}.fields`, "Lead forms require fields");
	} else if (props.fields.length > 20) {
		addIssue(issues, `${path}.fields`, "Lead forms support at most 20 fields");
	} else {
		for (const [index, field] of props.fields.entries()) {
			validateLeadField(field, issues, `${path}.fields.${index}`);
		}
	}

	validateOptionalTextProps(
		props,
		["title", "submitText"],
		issues,
		path,
		"short",
	);
	validateOptionalTextProps(props, ["successMessage"], issues, path, "long");
	validateTrackingProps(props, issues, path);
}

function resolveVideoEmbedUrlValue(provider: string, videoId: string) {
	const url =
		provider === "youtube"
			? new URL(`/embed/${videoId}`, "https://www.youtube-nocookie.com")
			: provider === "vimeo"
				? new URL(`/video/${videoId}`, "https://player.vimeo.com")
				: provider === "wistia"
					? new URL(`/embed/iframe/${videoId}`, "https://fast.wistia.net")
					: provider === "loom"
						? new URL(`/embed/${videoId}`, "https://www.loom.com")
						: null;

	return url?.toString() ?? null;
}

function validateVideoProps(
	props: Record<string, unknown>,
	issues: string[],
	path: string,
) {
	rejectUnknownProps(
		props,
		[
			"provider",
			"videoId",
			"title",
			"aspectRatio",
			"autoplay",
			"trackingEvents",
		],
		issues,
		path,
	);

	if (
		!["youtube", "vimeo", "wistia", "loom"].includes(String(props.provider))
	) {
		addIssue(issues, `${path}.provider`, "Invalid video provider");
	}
	if (!isSafeId(props.videoId)) {
		addIssue(issues, `${path}.videoId`, "videoId is required");
	}
	if (
		props.aspectRatio !== undefined &&
		!["16:9", "4:3", "1:1"].includes(String(props.aspectRatio))
	) {
		addIssue(issues, `${path}.aspectRatio`, "Invalid aspect ratio");
	}
	if (props.autoplay !== undefined && typeof props.autoplay !== "boolean") {
		addIssue(issues, `${path}.autoplay`, "Invalid autoplay flag");
	}
	const allowedVideoEvents = new Set([
		"video_play",
		"video_progress",
		"video_complete",
	]);
	if (props.trackingEvents !== undefined) {
		if (!Array.isArray(props.trackingEvents) || props.trackingEvents.length > 10) {
			addIssue(issues, `${path}.trackingEvents`, "Invalid video events");
		} else {
			for (const [index, eventName] of props.trackingEvents.entries()) {
				if (!allowedVideoEvents.has(String(eventName))) {
					addIssue(
						issues,
						`${path}.trackingEvents.${index}`,
						"Invalid video event",
					);
				}
			}
		}
	}
	if (
		typeof props.provider === "string" &&
		typeof props.videoId === "string" &&
		!resolveVideoEmbedUrlValue(props.provider, props.videoId)
	) {
		addIssue(issues, `${path}.videoId`, "Video embed could not be normalized");
	}
	validateOptionalTextProps(props, ["title"], issues, path, "short");
}

function validateOfferDisplayProps(
	props: Record<string, unknown>,
	issues: string[],
	path: string,
) {
	rejectUnknownProps(
		props,
		[
			"offerId",
			"headline",
			"description",
			"ctaText",
			"variant",
			"funnelStepId",
			"funnelRevision",
			"routePath",
		],
		issues,
		path,
	);

	if (!isSafeId(props.offerId)) {
		addIssue(issues, `${path}.offerId`, "offerId is required");
	}
	if (
		props.variant !== undefined &&
		!["card", "inline", "compact"].includes(String(props.variant))
	) {
		addIssue(issues, `${path}.variant`, "Invalid offer display variant");
	}

	validateOptionalTextProps(props, ["headline", "ctaText"], issues, path, "short");
	validateOptionalTextProps(props, ["description"], issues, path, "long");
	validateTrackingProps(props, issues, path);
}

function validateAnalyticsProps(
	props: Record<string, unknown>,
	issues: string[],
	path: string,
) {
	rejectUnknownProps(
		props,
		["enabledEvents", "funnelStepId", "funnelRevision", "routePath"],
		issues,
		path,
	);

	const allowedEvents = new Set([
		"page_view",
		"checkout_started",
		"lead_submitted",
		"purchase",
		"upsell_declined",
	]);

	if (!Array.isArray(props.enabledEvents) || props.enabledEvents.length === 0) {
		addIssue(issues, `${path}.enabledEvents`, "Analytics events are required");
	} else if (props.enabledEvents.length > 20) {
		addIssue(
			issues,
			`${path}.enabledEvents`,
			"Analytics supports at most 20 events",
		);
	} else {
		for (const [index, eventName] of props.enabledEvents.entries()) {
			if (!allowedEvents.has(String(eventName))) {
				addIssue(
					issues,
					`${path}.enabledEvents.${index}`,
					"Invalid analytics event",
				);
			}
		}
	}

	validateTrackingProps(props, issues, path);
}

function validateBlock(
	block: unknown,
	slotName: ManagedSlot,
	index: number,
	issues: string[],
) {
	const path = `slots.${slotName}.${index}`;
	if (!isRecord(block)) {
		addIssue(issues, path, "Invalid block");
		return;
	}

	if (typeof block.blockType !== "string") {
		addIssue(issues, `${path}.blockType`, "blockType is required");
		return;
	}

	if (!isRecord(block.props)) {
		addIssue(issues, `${path}.props`, "props are required");
		return;
	}

	const allowedSlots = (
		allowedSlotsByBlockType as Partial<
			Record<ManagedBlock["blockType"], readonly ManagedSlot[]>
		>
	)[block.blockType as ManagedBlock["blockType"]];
	if (!allowedSlots) {
		addIssue(issues, `${path}.blockType`, `Unknown block ${block.blockType}`);
		return;
	}
	if (!allowedSlots.includes(slotName)) {
		addIssue(
			issues,
			path,
			`${block.blockType} is not allowed in slot ${slotName}`,
		);
	}

	if (block.blockType === "CheckoutBlock") {
		validateCheckoutProps(block.props, issues, `${path}.props`);
	} else if (block.blockType === "UpsellBlock") {
		validateUpsellProps(block.props, issues, `${path}.props`);
	} else if (block.blockType === "LeadFormBlock") {
		validateLeadFormProps(block.props, issues, `${path}.props`);
	} else if (block.blockType === "OfferDisplayBlock") {
		validateOfferDisplayProps(block.props, issues, `${path}.props`);
	} else if (block.blockType === "VideoEmbedBlock") {
		validateVideoProps(block.props, issues, `${path}.props`);
	} else if (block.blockType === "AnalyticsBridge") {
		validateAnalyticsProps(block.props, issues, `${path}.props`);
	}
}

export function resolveManagedVideoEmbedUrl(props: VideoEmbedBlockProps) {
	return resolveVideoEmbedUrlValue(props.provider, props.videoId);
}

export function validateManagedPageDocument(document: unknown):
	| {
			success: true;
			document: ManagedPageDocument;
	  }
	| {
			success: false;
			issues: string[];
	  } {
	const issues: string[] = [];

	if (!isRecord(document)) {
		return { success: false, issues: ["Document must be an object"] };
	}
	if (document.schemaVersion !== 1) {
		addIssue(issues, "schemaVersion", "schemaVersion must be 1");
	}
	if (!isShortText(document.registryVersion)) {
		addIssue(issues, "registryVersion", "registryVersion is required");
	}
	if (!isRecord(document.slots)) {
		addIssue(issues, "slots", "slots are required");
	} else {
		const leadFormIds = new Set<string>();
		const videoIds = new Set<string>();
		for (const [slotName, blocks] of Object.entries(document.slots)) {
			if (!allowedManagedBlockSlots.includes(slotName as ManagedSlot)) {
				addIssue(issues, `slots.${slotName}`, "Managed slot is not allowed");
				continue;
			}
			if (!Array.isArray(blocks)) {
				addIssue(issues, `slots.${slotName}`, "Slot value must be an array");
				continue;
			}
			if (blocks.length > 50) {
				addIssue(
					issues,
					`slots.${slotName}`,
					"Slot supports at most 50 blocks",
				);
			}
			for (const [index, block] of blocks.entries()) {
				validateBlock(block, slotName as ManagedSlot, index, issues);
				if (
					isRecord(block) &&
					block.blockType === "LeadFormBlock" &&
					isRecord(block.props) &&
					typeof block.props.formId === "string"
				) {
					if (leadFormIds.has(block.props.formId)) {
						addIssue(
							issues,
							`slots.${slotName}.${index}.props.formId`,
							`Lead form ID ${block.props.formId} must be unique`,
						);
					}
					leadFormIds.add(block.props.formId);
				}
				if (
					isRecord(block) &&
					block.blockType === "VideoEmbedBlock" &&
					isRecord(block.props) &&
					typeof block.props.videoId === "string"
				) {
					if (videoIds.has(block.props.videoId)) {
						addIssue(
							issues,
							`slots.${slotName}.${index}.props.videoId`,
							`Video ID ${block.props.videoId} must be unique`,
						);
					}
					videoIds.add(block.props.videoId);
				}
			}
		}
	}

	if (issues.length > 0) {
		return { success: false, issues };
	}

	return { success: true, document: document as ManagedPageDocument };
}

export const managedPageDocumentSchema = {
	safeParse(document: unknown): SafeParseResult<ManagedPageDocument> {
		const result = validateManagedPageDocument(document);

		if (result.success) {
			return { success: true, data: result.document };
		}

		return {
			success: false,
			error: {
				issues: result.issues.map((message) => ({ message, path: [] })),
			},
		};
	},
};
