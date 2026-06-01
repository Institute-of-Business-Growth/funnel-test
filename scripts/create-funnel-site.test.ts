import { describe, expect, test } from "bun:test";
import {
	normalizeApexDomain,
	parseArgs,
	pollRegistrationStatus,
	priceWithinCap,
	resolveExistingWorkerDomainAttachment,
	UsageError,
	validateRegistrableDomain,
} from "./create-funnel-site";

const standardPricing = {
	currency: "USD",
	registration_cost: "10.46",
	renewal_cost: "10.46",
};

describe("create-funnel-site argument parsing", () => {
	test("parses existing-domain attachment flags", () => {
		const parsed = parseArgs([
			"funnel-test",
			"--org=Institute-of-Business-Growth",
			"--private",
			"--domain=TryAcquisity.COM",
		]);

		expect(parsed).toEqual({
			repoName: "funnel-test",
			org: "Institute-of-Business-Growth",
			isPrivate: true,
			domain: {
				domainName: "tryacquisity.com",
				purchase: false,
				maxRegistrationPriceUsd: undefined,
			},
		});
	});

	test("requires a price cap when purchasing a domain", () => {
		expect(() =>
			parseArgs([
				"funnel-test",
				"--domain=tryacquisity.com",
				"--purchase-domain",
			]),
		).toThrow(UsageError);
		expect(() =>
			parseArgs([
				"funnel-test",
				"--domain=tryacquisity.com",
				"--purchase-domain",
			]),
		).toThrow(/max-registration-price-usd/);
	});

	test("rejects purchase price caps without purchase mode", () => {
		expect(() =>
			parseArgs([
				"funnel-test",
				"--domain=tryacquisity.com",
				"--max-registration-price-usd=12",
			]),
		).toThrow(/only valid with --purchase-domain/);
	});
});

describe("apex domain validation", () => {
	test("normalizes lowercase apex domains", () => {
		expect(normalizeApexDomain("TryAcquisity.COM.")).toBe("tryacquisity.com");
	});

	test("rejects protocols, paths, wildcards, subdomains, and missing TLDs", () => {
		expect(() => normalizeApexDomain("https://tryacquisity.com")).toThrow(
			/bare apex domain/,
		);
		expect(() => normalizeApexDomain("tryacquisity.com/path")).toThrow(
			/bare apex domain/,
		);
		expect(() => normalizeApexDomain("*.tryacquisity.com")).toThrow(
			/wildcards/,
		);
		expect(() => normalizeApexDomain("www.tryacquisity.com")).toThrow(
			/apex domains/,
		);
		expect(() => normalizeApexDomain("tryacquisity")).toThrow(/apex domains/);
	});
});

describe("registrar availability checks", () => {
	test("accepts standard USD domains within the cap", () => {
		const result = validateRegistrableDomain(
			"tryacquisity.com",
			{
				domains: [
					{
						name: "tryacquisity.com",
						registrable: true,
						tier: "standard",
						pricing: standardPricing,
					},
				],
			},
			12,
		);

		expect(result.pricing.registration_cost).toBe("10.46");
		expect(priceWithinCap(result.pricing, 10.46)).toBe(true);
	});

	test("rejects unavailable domains", () => {
		expect(() =>
			validateRegistrableDomain(
				"tryacquisity.com",
				{
					domains: [
						{
							name: "tryacquisity.com",
							registrable: false,
							reason: "domain_unavailable",
						},
					],
				},
				12,
			),
		).toThrow(/not registrable/);
	});

	test("rejects premium domains and domains over the cap", () => {
		expect(() =>
			validateRegistrableDomain(
				"tryacquisity.com",
				{
					domains: [
						{
							name: "tryacquisity.com",
							registrable: true,
							tier: "premium",
							pricing: standardPricing,
						},
					],
				},
				12,
			),
		).toThrow(/premium/);

		expect(() =>
			validateRegistrableDomain(
				"tryacquisity.net",
				{
					domains: [
						{
							name: "tryacquisity.net",
							registrable: true,
							tier: "standard",
							pricing: {
								currency: "USD",
								registration_cost: "12.01",
								renewal_cost: "12.01",
							},
						},
					],
				},
				12,
			),
		).toThrow(/above --max-registration-price-usd/);
	});

	test("rejects unsupported TLDs", () => {
		expect(() =>
			validateRegistrableDomain(
				"tryacquisity.invalid",
				{
					domains: [
						{
							name: "tryacquisity.invalid",
							registrable: false,
							reason: "extension_not_supported_via_api",
						},
					],
				},
				12,
			),
		).toThrow(/not registrable/);
	});
});

describe("Worker domain attachment idempotency", () => {
	const existingDomain = {
		id: "worker-domain-id",
		cert_id: "cert-id",
		hostname: "tryacquisity.com",
		service: "funnel-test-funnel",
		zone_id: "zone-id",
		zone_name: "tryacquisity.com",
	};

	test("treats an existing hostname on the same Worker as success", () => {
		const result = resolveExistingWorkerDomainAttachment(
			[existingDomain],
			"tryacquisity.com",
			"funnel-test-funnel",
		);

		expect(result?.status).toBe("already-attached");
		expect(result?.domainId).toBe("worker-domain-id");
	});

	test("refuses to reassign a hostname from another Worker", () => {
		expect(() =>
			resolveExistingWorkerDomainAttachment(
				[existingDomain],
				"tryacquisity.com",
				"other-worker",
			),
		).toThrow(/already attached to Worker/);
	});
});

describe("registrar workflow polling", () => {
	test("polls until the async registration succeeds", async () => {
		let calls = 0;
		const result = await pollRegistrationStatus(
			"/accounts/account-id/registrar/registrations/tryacquisity.com/registration-status",
			async () => {
				calls += 1;
				if (calls === 1) {
					return {
						state: "running",
						completed: false,
					};
				}
				return {
					state: "succeeded",
					completed: true,
					context: {
						registration: {
							domain_name: "tryacquisity.com",
							status: "active",
							auto_renew: false,
						},
					},
				};
			},
			{ attempts: 3, intervalMs: 0 },
		);

		expect(calls).toBe(2);
		expect(result.state).toBe("succeeded");
	});

	test("throws when the async registration completes unsuccessfully", async () => {
		await expect(
			pollRegistrationStatus(
				"/status",
				async () => ({
					state: "failed",
					completed: true,
					error: {
						code: "registration_failed",
						message: "registration failed",
					},
				}),
				{ attempts: 1, intervalMs: 0 },
			),
		).rejects.toThrow(/did not succeed/);
	});

	test("throws immediately when registration needs manual action", async () => {
		let calls = 0;

		await expect(
			pollRegistrationStatus(
				"/status",
				async () => {
					calls += 1;
					return {
						state: "action_required",
						completed: false,
						error: {
							code: "accept_terms",
							message: "accept registrar terms",
						},
					};
				},
				{ attempts: 3, intervalMs: 0 },
			),
		).rejects.toThrow(/requires manual action/);
		expect(calls).toBe(1);
	});
});
