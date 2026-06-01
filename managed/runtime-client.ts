type RuntimeRequestInput = {
	websiteId: string;
	runtimeToken: string;
	path: string;
	body: Record<string, unknown>;
};

type RuntimeReadInput = {
	websiteId: string;
	runtimeToken: string;
	path: string;
};

const publicEnv = import.meta.env as Record<string, string | undefined>;

export const runtimeConfig = {
	websiteId:
		publicEnv.NEXT_PUBLIC_WEBSITE_ID ?? publicEnv.VITE_WEBSITE_ID ?? "",
	runtimeToken:
		publicEnv.NEXT_PUBLIC_WEBSITE_RUNTIME_TOKEN ??
		publicEnv.VITE_WEBSITE_RUNTIME_TOKEN ??
		"",
	runtimeUrl:
		publicEnv.NEXT_PUBLIC_ACQUISITY_RUNTIME_URL ??
		publicEnv.VITE_ACQUISITY_RUNTIME_URL ??
		"",
};

const runtimeUtmParamKeys = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
] as const;

const runtimeUtmPropertyNames = {
	utm_source: "utmSource",
	utm_medium: "utmMedium",
	utm_campaign: "utmCampaign",
	utm_term: "utmTerm",
	utm_content: "utmContent",
} as const;

export function isRuntimeConfigured() {
	return Boolean(
		runtimeConfig.runtimeUrl &&
			runtimeConfig.websiteId &&
			runtimeConfig.runtimeToken,
	);
}

export function getRuntimeUtm(): Record<string, string> | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}

	const searchParams = new URLSearchParams(window.location.search);
	const utm: Record<string, string> = {};
	for (const key of runtimeUtmParamKeys) {
		const value = searchParams.get(key)?.trim();
		if (value) {
			utm[key] = value.slice(0, 500);
		}
	}

	return Object.keys(utm).length > 0 ? utm : undefined;
}

function getRuntimeHostname(value: string): string | null {
	try {
		return new URL(value).hostname.slice(0, 240);
	} catch {
		return null;
	}
}

export function getRuntimeTrafficProperties(): Record<string, string> {
	const properties: Record<string, string> = {};
	const utm = getRuntimeUtm();
	for (const key of runtimeUtmParamKeys) {
		const value = utm?.[key];
		if (value) {
			properties[runtimeUtmPropertyNames[key]] = value;
		}
	}

	if (typeof document !== "undefined" && document.referrer) {
		properties.referrer = document.referrer.slice(0, 500);
		const referrerDomain = getRuntimeHostname(document.referrer);
		if (referrerDomain) {
			properties.referrerDomain = referrerDomain;
		}
	}

	return properties;
}

export async function postRuntimeEvent(input: RuntimeRequestInput) {
	const baseUrl = runtimeConfig.runtimeUrl.replace(/\/$/, "");
	if (!baseUrl || !input.websiteId || !input.runtimeToken) {
		throw new Error("Missing managed runtime configuration");
	}

	const response = await fetch(
		`${baseUrl}/api/sites/${input.websiteId}/runtime${input.path}`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-website-runtime-token": input.runtimeToken,
			},
			body: JSON.stringify(input.body),
		},
	);

	if (!response.ok) {
		throw new Error("Managed runtime request failed");
	}

	return response.json() as Promise<Record<string, unknown>>;
}

export async function getRuntimeData(input: RuntimeReadInput) {
	const baseUrl = runtimeConfig.runtimeUrl.replace(/\/$/, "");
	if (!baseUrl || !input.websiteId || !input.runtimeToken) {
		throw new Error("Missing managed runtime configuration");
	}

	const response = await fetch(
		`${baseUrl}/api/sites/${input.websiteId}/runtime${input.path}`,
		{
			headers: {
				"x-website-runtime-token": input.runtimeToken,
			},
		},
	);

	if (!response.ok) {
		throw new Error("Managed runtime request failed");
	}

	return response.json() as Promise<Record<string, unknown>>;
}
