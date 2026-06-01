#!/usr/bin/env bun

/**
 * Create a new funnel site at scale:
 *   1. Create a GitHub repo (via GitHub App)
 *   2. Push the funnel template to it
 *   3. Create a Cloudflare Worker
 *   4. Connect the repo to Cloudflare
 *   5. Enable auto-deploy on push to main
 *
 * Usage:
 *   bun run scripts/create-funnel-site.ts <new-repo-name> [--org=acme] [--private] [--domain=example.com]
 *
 * Example:
 *   bun run scripts/create-funnel-site.ts acme-corp-funnel --org=acme --private
 *   bun run scripts/create-funnel-site.ts acme-corp-funnel --domain=example.com
 *   bun run scripts/create-funnel-site.ts acme-corp-funnel --domain=example.com --purchase-domain --max-registration-price-usd=12
 */

import { spawn } from "node:child_process";
import {
	copyFile,
	mkdir,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { App } from "@octokit/app";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface PipelineResult {
	github: {
		repoName: string;
		repoUrl: string;
		repoId: number;
		owner: string;
		ownerId: number;
	};
	cloudflare: {
		workerName: string;
		workerUrl: string;
		workerTag: string;
		repoConnectionUuid: string;
		triggerUuid: string;
		buildUuid: string;
		domains?: DomainProvisioningResult;
	};
}

interface CloudflareApiResponse<T> {
	success: boolean;
	result?: T;
	errors?: Array<{ code: number; message: string }>;
}

interface CloudflareFetchOptions {
	method?: string;
	body?: unknown;
	headers?: Record<string, string>;
}

interface CliOptions {
	repoName: string;
	org?: string;
	isPrivate: boolean;
	domain?: DomainOptions;
}

interface DomainOptions {
	domainName: string;
	purchase: boolean;
	maxRegistrationPriceUsd?: number;
}

interface DomainPreflight {
	mode: "existing" | "purchase";
	domainName: string;
	zone?: CloudflareZone;
	availability?: RegistrableDomain;
}

interface DomainProvisioningResult {
	zoneId: string;
	zoneName: string;
	hostnames: DomainAttachmentResult[];
	registration?: DomainRegistrationResult;
}

interface DomainAttachmentResult {
	hostname: string;
	domainId: string;
	service: string;
	zoneId: string;
	zoneName: string;
	certId?: string;
	status: "attached" | "already-attached";
}

interface DomainRegistrationResult {
	domainName: string;
	status: string;
	state: string;
	autoRenew: boolean;
	price: RegistrarPricing;
}

interface GitHubInstallationAuth {
	token: string;
}

interface GitHubRepoData {
	id: number;
	clone_url: string;
	html_url: string;
	owner: {
		login: string;
		id: number;
	};
}

interface CloudflareTokenVerifyResult {
	id: string;
	status: string;
}

interface CloudflareZone {
	id: string;
	name: string;
	status?: string;
	type?: string;
}

interface RegistrarPricing {
	currency: string;
	registration_cost: string;
	renewal_cost: string;
}

interface RegistrarDomainCheckResult {
	domains: RegistrarDomainCheckDomain[];
}

interface RegistrarDomainCheckDomain {
	name: string;
	registrable: boolean;
	pricing?: RegistrarPricing;
	reason?: string;
	tier?: "standard" | "premium";
}

interface RegistrableDomain {
	name: string;
	pricing: RegistrarPricing;
	tier: "standard";
}

interface RegistrarWorkflowStatus {
	domain_name?: string;
	state: string;
	completed: boolean;
	error?: {
		code: string;
		message: string;
	};
	context?: {
		registration?: {
			domain_name: string;
			status: string;
			auto_renew?: boolean;
		};
	};
	links?: {
		self?: string;
		resource?: string;
	};
}

interface WorkerDomain {
	id: string;
	cert_id?: string;
	hostname: string;
	service: string;
	zone_id: string;
	zone_name: string;
}

type CloudflareFetcher<T> = (
	path: string,
	options?: CloudflareFetchOptions,
) => Promise<T>;

// ────────────────────────────────────────────
// Config validation
// ────────────────────────────────────────────

export class UsageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UsageError";
	}
}

function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		console.error(`❌ Missing required env var: ${key}`);
		console.error(`   Add it to your .env file`);
		process.exit(1);
	}
	return value;
}

async function loadPrivateKey(): Promise<string> {
	const raw = requireEnv("GITHUB_APP_PRIVATE_KEY");
	// If it already looks like a PEM, return as-is
	if (raw.includes("-----BEGIN")) {
		return raw.replace(/\\n/g, "\n");
	}
	// Otherwise treat as a file path
	return await readFile(raw, "utf8");
}

function exec(cmd: string, args: string[], cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd, stdio: "inherit" });
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
		});
	});
}

// ────────────────────────────────────────────
// CLI argument parsing
// ────────────────────────────────────────────

function usage(): string {
	return [
		"Usage: bun run scripts/create-funnel-site.ts <repo-name> [--org=orgname] [--private] [--domain=example.com]",
		"       bun run scripts/create-funnel-site.ts <repo-name> --domain=example.com --purchase-domain --max-registration-price-usd=12",
	].join("\n");
}

export function parseArgs(args = process.argv.slice(2)): CliOptions {
	if (args.length === 0) {
		throw new UsageError(usage());
	}

	const positional = args.filter((a) => !a.startsWith("--"));
	if (positional.length !== 1) {
		throw new UsageError(usage());
	}

	const knownBooleanFlags = new Set(["--private", "--purchase-domain"]);
	const knownValuePrefixes = [
		"--org=",
		"--domain=",
		"--max-registration-price-usd=",
	];
	for (const arg of args) {
		if (!arg.startsWith("--")) continue;
		if (knownBooleanFlags.has(arg)) continue;
		if (knownValuePrefixes.some((prefix) => arg.startsWith(prefix))) continue;
		throw new UsageError(`Unknown option: ${arg}\n${usage()}`);
	}

	const repoName = positional[0]!;
	const orgFlag = args.find((a) => a.startsWith("--org="));
	const org = orgFlag ? orgFlag.split("=")[1] : undefined;
	if (orgFlag && !org) {
		throw new UsageError("--org must not be empty");
	}

	const isPrivate = args.includes("--private");
	const purchase = args.includes("--purchase-domain");
	const domainFlag = args.find((a) => a.startsWith("--domain="));
	const maxPriceFlag = args.find((a) =>
		a.startsWith("--max-registration-price-usd="),
	);

	let domain: DomainOptions | undefined;
	if (domainFlag) {
		const domainName = normalizeApexDomain(domainFlag.split("=")[1] ?? "");
		const maxRegistrationPriceUsd = maxPriceFlag
			? parseMaxRegistrationPrice(maxPriceFlag.split("=")[1] ?? "")
			: undefined;

		if (purchase && maxRegistrationPriceUsd === undefined) {
			throw new UsageError(
				"--max-registration-price-usd is required when --purchase-domain is set",
			);
		}

		domain = {
			domainName,
			purchase,
			maxRegistrationPriceUsd,
		};
	} else {
		if (purchase) {
			throw new UsageError(
				"--domain is required when --purchase-domain is set",
			);
		}
		if (maxPriceFlag) {
			throw new UsageError(
				"--domain is required when --max-registration-price-usd is set",
			);
		}
	}

	if (!purchase && maxPriceFlag) {
		throw new UsageError(
			"--max-registration-price-usd is only valid with --purchase-domain",
		);
	}

	return { repoName, org, isPrivate, domain };
}

export function normalizeApexDomain(input: string): string {
	const trimmed = input.trim();
	const domain = trimmed.toLowerCase().replace(/\.$/, "");
	if (!domain) {
		throw new UsageError("--domain must not be empty");
	}
	if (domain.includes("://") || /[/?#:]/.test(domain)) {
		throw new UsageError(
			"--domain must be a bare apex domain like example.com",
		);
	}
	if (domain.includes("*")) {
		throw new UsageError("--domain must not contain wildcards");
	}
	if (domain.startsWith("www.")) {
		throw new UsageError(
			"V1 only accepts apex domains. Pass example.com, not www.example.com.",
		);
	}

	const labels = domain.split(".");
	if (labels.length !== 2) {
		throw new UsageError(
			"V1 only accepts apex domains with one label and one TLD, like example.com.",
		);
	}

	const [name, tld] = labels;
	const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
	if (
		!name ||
		!tld ||
		!labelPattern.test(name) ||
		!/^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tld)
	) {
		throw new UsageError("--domain must be a valid domain like example.com");
	}

	return domain;
}

function parseMaxRegistrationPrice(raw: string): number {
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) {
		throw new UsageError(
			"--max-registration-price-usd must be a positive number",
		);
	}
	return value;
}

// ────────────────────────────────────────────
// GitHub: create repo + push code
// ────────────────────────────────────────────

async function createGitHubRepo(
	octokit: Awaited<ReturnType<App["getInstallationOctokit"]>>,
	repoName: string,
	org: string | undefined,
	isPrivate: boolean,
): Promise<{
	repoId: number;
	cloneUrl: string;
	owner: string;
	ownerId: number;
}> {
	console.log(`\n📦 Step 1: Creating GitHub repo "${repoName}"...`);

	const params = {
		name: repoName,
		private: isPrivate,
		description: `Funnel site: ${repoName}`,
		auto_init: false,
	};

	let repo: GitHubRepoData;
	try {
		if (org) {
			const response = await octokit.request("POST /orgs/{org}/repos", {
				org,
				...params,
			});
			repo = response.data as GitHubRepoData;
		} else {
			const response = await octokit.request("POST /user/repos", params);
			repo = response.data as GitHubRepoData;
		}
	} catch (error) {
		if (
			!(error instanceof Error) ||
			!error.message.includes("name already exists")
		) {
			throw error;
		}

		console.log(
			`   Repo already exists. Reusing ${org ? `${org}/` : ""}${repoName}.`,
		);
		if (!org) {
			const user = await octokit.request("GET /user");
			const response = await octokit.request("GET /repos/{owner}/{repo}", {
				owner: user.data.login,
				repo: repoName,
			});
			repo = response.data as GitHubRepoData;
		} else {
			const response = await octokit.request("GET /repos/{owner}/{repo}", {
				owner: org,
				repo: repoName,
			});
			repo = response.data as GitHubRepoData;
		}
	}

	console.log(`   ✅ Ready: ${repo.html_url}`);
	return {
		repoId: repo.id,
		cloneUrl: repo.clone_url,
		owner: repo.owner.login,
		ownerId: repo.owner.id,
	};
}

async function copyTemplateFiles(
	targetDir: string,
	workerName: string,
): Promise<void> {
	const sourceDir = process.cwd();
	const ignorePatterns = [
		"node_modules",
		"dist",
		"dist-ssr",
		".git",
		".env",
		".env.local",
		"bun.lockb",
		".DS_Store",
		"*.log",
	];

	async function copyRecursive(src: string, dest: string) {
		const entries = await readdir(src, { withFileTypes: true });
		for (const entry of entries) {
			if (ignorePatterns.includes(entry.name)) continue;

			const srcPath = join(src, entry.name);
			const destPath = join(dest, entry.name);

			if (entry.isDirectory()) {
				await mkdir(destPath, { recursive: true });
				await copyRecursive(srcPath, destPath);
			} else {
				await copyFile(srcPath, destPath);
			}
		}
	}

	await copyRecursive(sourceDir, targetDir);

	// Update wrangler.toml with the new worker name
	const wranglerPath = join(targetDir, "wrangler.toml");
	let wranglerContent = await readFile(wranglerPath, "utf8");
	wranglerContent = wranglerContent.replace(
		/name = ".*?"/,
		`name = "${workerName}"`,
	);
	await writeFile(wranglerPath, wranglerContent);

	const wranglerJsonPath = join(targetDir, "wrangler.jsonc");
	const wranglerJsonContent = await readFile(wranglerJsonPath, "utf8");
	const wranglerJson = JSON.parse(wranglerJsonContent);
	wranglerJson.name = workerName;
	await writeFile(
		wranglerJsonPath,
		`${JSON.stringify(wranglerJson, null, "\t")}\n`,
	);

	// Update package.json with the new name
	const pkgPath = join(targetDir, "package.json");
	const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
	pkg.name = workerName;
	await writeFile(pkgPath, JSON.stringify(pkg, null, "\t"));
}

async function pushToGitHub(
	cloneUrl: string,
	token: string,
	workerName: string,
): Promise<void> {
	console.log(`\n📤 Step 2: Pushing template code to new repo...`);

	const tempDir = join("/tmp", `funnel-${Date.now()}`);
	await mkdir(tempDir, { recursive: true });

	try {
		await copyTemplateFiles(tempDir, workerName);

		// Replace https://github.com/... with https://x-access-token:TOKEN@github.com/...
		const authUrl = cloneUrl.replace(
			"https://",
			`https://x-access-token:${token}@`,
		);

		const commands: Array<[string, string[]]> = [
			["git", ["init", "-b", "main"]],
			["git", ["config", "user.email", "noreply@acquisity.ai"]],
			["git", ["config", "user.name", "Acquisity Funnel Builder"]],
			["git", ["add", "."]],
			["git", ["commit", "-m", "Initial funnel template"]],
			["git", ["remote", "add", "origin", authUrl]],
			["git", ["push", "-u", "origin", "main", "--force"]],
		];

		for (const [cmd, args] of commands) {
			await exec(cmd, args, tempDir);
		}

		console.log(`   ✅ Pushed to: ${cloneUrl.replace(token, "***")}`);
	} finally {
		// Cleanup
		await rm(tempDir, { recursive: true, force: true });
	}
}

// ────────────────────────────────────────────
// Cloudflare API helpers
// ────────────────────────────────────────────

async function cloudflareFetch<T>(
	path: string,
	options: CloudflareFetchOptions = {},
): Promise<T> {
	const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
	return await cloudflareApiFetch<T>(`/accounts/${accountId}${path}`, options);
}

async function cloudflareApiFetch<T>(
	path: string,
	options: CloudflareFetchOptions = {},
): Promise<T> {
	const { result } = await cloudflareApiRequest<T>(path, options);
	return result;
}

async function cloudflareApiRequest<T>(
	path: string,
	options: CloudflareFetchOptions = {},
): Promise<{ result: T; status: number }> {
	const token = requireEnv("CLOUDFLARE_API_TOKEN");
	const url = `https://api.cloudflare.com/client/v4${path}`;

	const response = await fetch(url, {
		method: options.method ?? "GET",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...(options.headers ?? {}),
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});

	const data = (await response.json()) as CloudflareApiResponse<T>;
	if (!response.ok || !data.success) {
		const errorMsg =
			data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
		throw new Error(`Cloudflare API error (${response.status}): ${errorMsg}`);
	}
	return { result: data.result as T, status: response.status };
}

// ────────────────────────────────────────────
// Cloudflare: create worker + connect + trigger
// ────────────────────────────────────────────

async function uploadPlaceholderWorker(workerName: string): Promise<void> {
	console.log(
		`\n☁️  Step 3: Creating placeholder Worker "${workerName}" via API...`,
	);

	const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
	const token = requireEnv("CLOUDFLARE_API_TOKEN");
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/content`;
	const workerModule = `export default {
	async fetch() {
		return new Response("Provisioning ${workerName}. Cloudflare Builds will replace this deployment.", {
			headers: { "content-type": "text/plain; charset=utf-8" },
		});
	},
};
`;
	const metadata = {
		main_module: "worker.js",
		compatibility_date: "2026-06-01",
	};
	const form = new FormData();
	form.append(
		"metadata",
		new Blob([JSON.stringify(metadata)], { type: "application/json" }),
	);
	form.append(
		"worker.js",
		new Blob([workerModule], { type: "application/javascript+module" }),
		"worker.js",
	);

	const response = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: form,
	});
	const data = (await response.json()) as CloudflareApiResponse<unknown>;
	if (!data.success) {
		const errorMsg =
			data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
		throw new Error(`Cloudflare API error: ${errorMsg}`);
	}

	console.log(`   ✅ Placeholder Worker uploaded: ${workerName}`);
}

async function getWorkerTag(workerName: string): Promise<string> {
	const result =
		await cloudflareFetch<Array<{ id: string; tag?: string }>>(
			`/workers/scripts`,
		);
	const worker = result.find((w) => w.id === workerName);
	if (!worker?.tag) {
		throw new Error(`Could not find worker tag for ${workerName}`);
	}
	return worker.tag;
}

interface RepoConnectionResult {
	repo_connection_uuid: string;
}

async function connectRepoToCloudflare(
	repoId: number,
	repoName: string,
	owner: string,
	ownerId: number,
): Promise<string> {
	console.log(`\n🔗 Step 4: Connecting repo to Cloudflare...`);

	const result = await cloudflareFetch<RepoConnectionResult>(
		"/builds/repos/connections",
		{
			method: "PUT",
			body: {
				provider_type: "github",
				provider_account_id: String(ownerId),
				provider_account_name: owner,
				repo_id: String(repoId),
				repo_name: repoName,
			},
		},
	);

	console.log(
		`   ✅ Repo connection established: ${result.repo_connection_uuid}`,
	);
	return result.repo_connection_uuid;
}

interface TriggerResult {
	trigger_uuid: string;
}

interface BuildListResult {
	trigger?: {
		trigger_uuid?: string;
	};
}

interface BuildTokenResult {
	build_token_uuid: string;
	build_token_name: string;
	cloudflare_token_id: string;
	owner_type: string;
}

async function createBuildToken(workerName: string): Promise<string> {
	console.log(`\n🔐 Creating fresh Cloudflare Workers Build token...`);

	const token = requireEnv("CLOUDFLARE_API_TOKEN");
	const verifiedToken = await cloudflareApiFetch<CloudflareTokenVerifyResult>(
		"/user/tokens/verify",
	);
	await assertCanReadMemberships();

	const result = await cloudflareFetch<BuildTokenResult>("/builds/tokens", {
		method: "POST",
		body: {
			build_token_name: `${workerName} builds ${new Date().toISOString()}`,
			cloudflare_token_id: verifiedToken.id,
			build_token_secret: token,
		},
	});

	console.log(`   ✅ Build token created: ${result.build_token_uuid}`);
	return result.build_token_uuid;
}

async function assertCanReadMemberships(): Promise<void> {
	try {
		await cloudflareApiFetch<unknown>("/memberships");
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("Authentication error")
		) {
			throw new Error(
				"Cloudflare token can create Workers Build tokens, but cannot read user memberships. Add `User -> Memberships -> Read`, then rerun so the script can create a build token Cloudflare's build runner can validate.",
			);
		}
		throw error;
	}

	const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
	try {
		await cloudflareApiFetch<unknown>(`/accounts/${accountId}/members`);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("Authentication error")
		) {
			throw new Error(
				"Cloudflare token can read user memberships, but cannot read account members. Add `Account -> Account Settings -> Read`, then rerun so Cloudflare's build runner can validate the build token owner against this account.",
			);
		}
		throw error;
	}
}

async function createBuildTrigger(
	workerTag: string,
	repoConnectionUuid: string,
	workerName: string,
): Promise<string> {
	console.log(`\n🚀 Step 5: Creating auto-deploy trigger...`);

	const buildTokenUuid =
		process.env.CLOUDFLARE_BUILD_TOKEN_UUID ??
		(await createBuildToken(workerName));
	if (process.env.CLOUDFLARE_BUILD_TOKEN_UUID) {
		console.log(`   Using configured build token: ${buildTokenUuid}`);
	}

	const triggerPayload = {
		external_script_id: workerTag,
		repo_connection_uuid: repoConnectionUuid,
		build_token_uuid: buildTokenUuid,
		trigger_name: "Production Deploy",
		build_command: "bun run build",
		deploy_command: "bunx wrangler deploy",
		root_directory: "/",
		branch_includes: ["main"],
		branch_excludes: [],
		path_includes: ["*"],
		path_excludes: [],
	};

	try {
		const result = await cloudflareFetch<TriggerResult>("/builds/triggers", {
			method: "POST",
			body: triggerPayload,
		});

		console.log(`   ✅ Trigger created: ${result.trigger_uuid}`);
		return result.trigger_uuid;
	} catch (error) {
		if (
			!(error instanceof Error) ||
			!error.message.includes("trigger already exists")
		) {
			throw error;
		}
	}

	const existingTriggerUuid = await findExistingTriggerUuid(workerTag);
	const result = await cloudflareFetch<TriggerResult>(
		`/builds/triggers/${existingTriggerUuid}`,
		{
			method: "PATCH",
			body: triggerPayload,
		},
	);

	console.log(`   ✅ Trigger updated: ${result.trigger_uuid}`);
	return result.trigger_uuid;
}

async function findExistingTriggerUuid(workerTag: string): Promise<string> {
	const builds = await cloudflareFetch<BuildListResult[]>(
		`/builds/workers/${workerTag}/builds`,
	);
	const triggerUuid = builds.find((build) => build.trigger?.trigger_uuid)
		?.trigger?.trigger_uuid;
	if (!triggerUuid) {
		throw new Error(
			"A build trigger already exists, but its UUID could not be discovered from build history",
		);
	}
	return triggerUuid;
}

async function triggerBuild(triggerUuid: string): Promise<string> {
	console.log(`\n🏁 Step 6: Starting Cloudflare-hosted build...`);

	const result = await cloudflareFetch<{ build_uuid: string }>(
		`/builds/triggers/${triggerUuid}/builds`,
		{
			method: "POST",
			body: {
				branch: "main",
			},
		},
	);
	console.log(`   ✅ Build started: ${result.build_uuid}`);
	return result.build_uuid;
}

// ────────────────────────────────────────────
// Cloudflare: domain registration + Worker domains
// ────────────────────────────────────────────

async function preflightDomainProvisioning(
	domain: DomainOptions | undefined,
): Promise<DomainPreflight | undefined> {
	if (!domain) return undefined;

	console.log(`\n🌐 Domain preflight: ${domain.domainName}`);

	if (!domain.purchase) {
		const zone = await requireExistingZone(domain.domainName);
		console.log(
			`   ✅ Existing Cloudflare zone found: ${zone.name} (${zone.id})`,
		);
		return {
			mode: "existing",
			domainName: domain.domainName,
			zone,
		};
	}

	const maxPrice = requireMaxRegistrationPrice(domain);
	const availability = await checkDomainAvailabilityForPurchase(
		domain.domainName,
		maxPrice,
	);
	console.log(
		`   ✅ Domain is available: ${availability.name} ${availability.pricing.currency} ${availability.pricing.registration_cost}`,
	);
	return {
		mode: "purchase",
		domainName: domain.domainName,
		availability,
	};
}

async function checkDomainAvailabilityForPurchase(
	domainName: string,
	maxRegistrationPriceUsd: number,
): Promise<RegistrableDomain> {
	const check = await cloudflareFetch<RegistrarDomainCheckResult>(
		"/registrar/domain-check",
		{
			method: "POST",
			body: {
				domains: [domainName],
			},
		},
	);
	return validateRegistrableDomain(domainName, check, maxRegistrationPriceUsd);
}

export function validateRegistrableDomain(
	domainName: string,
	check: RegistrarDomainCheckResult,
	maxRegistrationPriceUsd: number,
): RegistrableDomain {
	const domain = check.domains.find(
		(candidate) => candidate.name === domainName,
	);
	if (!domain) {
		throw new Error(
			`Cloudflare Registrar did not return an availability result for ${domainName}`,
		);
	}
	if (!domain.registrable) {
		throw new Error(
			`Domain ${domainName} is not registrable via API: ${domain.reason ?? "unknown reason"}`,
		);
	}
	if (domain.tier !== "standard") {
		throw new Error(
			`Domain ${domainName} is ${domain.tier ?? "not standard"}; premium registration is not supported`,
		);
	}
	if (!domain.pricing) {
		throw new Error(
			`Cloudflare Registrar did not return pricing for ${domainName}`,
		);
	}
	if (domain.pricing.currency !== "USD") {
		throw new Error(
			`Domain ${domainName} returned ${domain.pricing.currency} pricing; only USD caps are supported`,
		);
	}
	if (!priceWithinCap(domain.pricing, maxRegistrationPriceUsd)) {
		throw new Error(
			`Domain ${domainName} costs $${domain.pricing.registration_cost}, above --max-registration-price-usd=${maxRegistrationPriceUsd}`,
		);
	}

	return {
		name: domain.name,
		pricing: domain.pricing,
		tier: "standard",
	};
}

export function priceWithinCap(
	pricing: RegistrarPricing,
	maxRegistrationPriceUsd: number,
): boolean {
	const registrationCost = Number(pricing.registration_cost);
	return (
		Number.isFinite(registrationCost) &&
		registrationCost <= maxRegistrationPriceUsd
	);
}

async function registerDomain(
	domain: DomainOptions,
): Promise<DomainRegistrationResult> {
	const maxPrice = requireMaxRegistrationPrice(domain);
	console.log(`\n💳 Registering domain ${domain.domainName}...`);

	// Check immediately before registration. Availability can change between preflight and purchase.
	const availability = await checkDomainAvailabilityForPurchase(
		domain.domainName,
		maxPrice,
	);
	const registrant = readRegistrantContact();
	const body: Record<string, unknown> = {
		domain_name: domain.domainName,
		auto_renew: false,
	};
	if (registrant) {
		body.contacts = {
			registrant,
		};
	}

	const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
	const { result: initialStatus, status } =
		await cloudflareApiRequest<RegistrarWorkflowStatus>(
			`/accounts/${accountId}/registrar/registrations`,
			{
				method: "POST",
				body,
			},
		);
	if (![200, 201, 202].includes(status)) {
		console.log(
			`   Cloudflare returned HTTP ${status}; continuing because the API response was successful.`,
		);
	}

	const completedStatus = initialStatus.completed
		? assertSuccessfulRegistration(initialStatus)
		: await pollRegistrationStatus(
				initialStatus.links?.self ??
					`/accounts/${accountId}/registrar/registrations/${domain.domainName}/registration-status`,
			);
	const registration = completedStatus.context?.registration;
	const result = {
		domainName:
			registration?.domain_name ??
			completedStatus.domain_name ??
			domain.domainName,
		status: registration?.status ?? completedStatus.state,
		state: completedStatus.state,
		autoRenew: registration?.auto_renew ?? false,
		price: availability.pricing,
	};

	console.log(
		`   ✅ Domain registered: ${result.domainName} (${result.status})`,
	);
	return result;
}

function readRegistrantContact(): unknown | undefined {
	const raw = process.env.CLOUDFLARE_REGISTRANT_CONTACT_JSON;
	if (!raw) return undefined;

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("registrant contact must be a JSON object");
		}
		return parsed;
	} catch (error) {
		const detail = error instanceof Error ? error.message : "invalid JSON";
		throw new Error(`CLOUDFLARE_REGISTRANT_CONTACT_JSON is invalid: ${detail}`);
	}
}

export async function pollRegistrationStatus(
	statusPath: string,
	fetcher: CloudflareFetcher<RegistrarWorkflowStatus> = cloudflareApiFetch,
	options: { attempts?: number; intervalMs?: number } = {},
): Promise<RegistrarWorkflowStatus> {
	const attempts = options.attempts ?? 24;
	const intervalMs = options.intervalMs ?? 5000;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const status = await fetcher(statusPath);
		if (status.state === "action_required") {
			throw new Error(
				`Domain registration requires manual action: ${status.error?.message ?? "check Cloudflare Registrar"}`,
			);
		}
		if (status.completed) {
			return assertSuccessfulRegistration(status);
		}
		if (attempt < attempts) {
			await delay(intervalMs);
		}
	}

	throw new Error(
		`Timed out waiting for domain registration status at ${statusPath}`,
	);
}

function assertSuccessfulRegistration(
	status: RegistrarWorkflowStatus,
): RegistrarWorkflowStatus {
	if (!status.completed) return status;
	if (status.state !== "succeeded") {
		throw new Error(
			`Domain registration did not succeed: ${status.state}${status.error?.message ? ` (${status.error.message})` : ""}`,
		);
	}
	return status;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function requireExistingZone(
	domainName: string,
): Promise<CloudflareZone> {
	const zone = await findZone(domainName);
	if (!zone) {
		const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
		throw new Error(
			`Cloudflare zone "${domainName}" was not found in account ${accountId}. Add the zone first or rerun with --purchase-domain.`,
		);
	}
	return zone;
}

async function getOrCreateZone(domainName: string): Promise<CloudflareZone> {
	const existingZone = await findZone(domainName);
	if (existingZone) {
		console.log(
			`   ✅ Reusing Cloudflare zone: ${existingZone.name} (${existingZone.id})`,
		);
		return existingZone;
	}

	const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
	console.log(`   Creating Cloudflare zone: ${domainName}`);
	try {
		const zone = await cloudflareApiFetch<CloudflareZone>("/zones", {
			method: "POST",
			body: {
				account: {
					id: accountId,
				},
				name: domainName,
				type: "full",
			},
		});
		console.log(`   ✅ Zone created: ${zone.name} (${zone.id})`);
		return zone;
	} catch (error) {
		if (error instanceof Error && error.message.includes("already exists")) {
			return await requireExistingZone(domainName);
		}
		throw error;
	}
}

async function findZone(
	domainName: string,
): Promise<CloudflareZone | undefined> {
	const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
	const zones = await cloudflareApiFetch<CloudflareZone[]>(
		`/zones?account.id=${encodeURIComponent(accountId)}&name=${encodeURIComponent(domainName)}`,
	);
	return zones.find((zone) => zone.name === domainName);
}

async function provisionDomainForWorker(
	workerName: string,
	domain: DomainOptions | undefined,
	preflight: DomainPreflight | undefined,
): Promise<DomainProvisioningResult | undefined> {
	if (!domain) return undefined;

	console.log(`\n🌐 Step 7: Connecting custom domain ${domain.domainName}...`);

	let registration: DomainRegistrationResult | undefined;
	let zone: CloudflareZone;
	if (domain.purchase) {
		registration = await registerDomain(domain);
		zone = await getOrCreateZone(domain.domainName);
	} else {
		zone = preflight?.zone ?? (await requireExistingZone(domain.domainName));
	}

	const hostnames = await attachWorkerDomains(
		workerName,
		domain.domainName,
		zone,
	);
	return {
		zoneId: zone.id,
		zoneName: zone.name,
		hostnames,
		registration,
	};
}

async function attachWorkerDomains(
	workerName: string,
	domainName: string,
	zone: CloudflareZone,
): Promise<DomainAttachmentResult[]> {
	const hostnames = [domainName, `www.${domainName}`];
	const existingDomains =
		await cloudflareFetch<WorkerDomain[]>("/workers/domains");
	const results: DomainAttachmentResult[] = [];

	for (const hostname of hostnames) {
		const existingAttachment = resolveExistingWorkerDomainAttachment(
			existingDomains,
			hostname,
			workerName,
		);
		if (existingAttachment) {
			console.log(`   ✅ Already attached: ${hostname}`);
			results.push(existingAttachment);
			continue;
		}

		console.log(`   Attaching ${hostname} -> ${workerName}`);
		const attachedDomain = await cloudflareFetch<WorkerDomain>(
			"/workers/domains",
			{
				method: "PUT",
				body: {
					hostname,
					service: workerName,
					environment: "production",
					zone_id: zone.id,
					zone_name: zone.name,
				},
			},
		);
		existingDomains.push(attachedDomain);
		results.push(toDomainAttachmentResult(attachedDomain, "attached"));
		console.log(`   ✅ Attached: ${hostname}`);
	}

	return results;
}

export function resolveExistingWorkerDomainAttachment(
	existingDomains: WorkerDomain[],
	hostname: string,
	workerName: string,
): DomainAttachmentResult | undefined {
	const existingDomain = existingDomains.find(
		(domain) => domain.hostname === hostname,
	);
	if (!existingDomain) return undefined;
	if (existingDomain.service !== workerName) {
		throw new Error(
			`${hostname} is already attached to Worker "${existingDomain.service}", not "${workerName}". Refusing to reassign it automatically.`,
		);
	}
	return toDomainAttachmentResult(existingDomain, "already-attached");
}

function toDomainAttachmentResult(
	domain: WorkerDomain,
	status: DomainAttachmentResult["status"],
): DomainAttachmentResult {
	return {
		hostname: domain.hostname,
		domainId: domain.id,
		service: domain.service,
		zoneId: domain.zone_id,
		zoneName: domain.zone_name,
		certId: domain.cert_id,
		status,
	};
}

function requireMaxRegistrationPrice(domain: DomainOptions): number {
	if (domain.maxRegistrationPriceUsd === undefined) {
		throw new Error(
			"--max-registration-price-usd is required when --purchase-domain is set",
		);
	}
	return domain.maxRegistrationPriceUsd;
}

// ────────────────────────────────────────────
// Main
// ────────────────────────────────────────────

async function main() {
	const { repoName, org, isPrivate, domain } = parseArgs();
	const workerName = `${repoName}-funnel`;

	console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(`🏗️  Funnel Site Provisioning Pipeline`);
	console.log(`   Repo:   ${repoName}`);
	console.log(`   Worker: ${workerName}`);
	console.log(`   Org:    ${org ?? "(user)"}`);
	console.log(`   Private: ${isPrivate}`);
	console.log(
		`   Domain: ${domain ? `${domain.domainName}${domain.purchase ? " (purchase)" : ""}` : "(none)"}`,
	);
	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

	const domainPreflight = await preflightDomainProvisioning(domain);

	// Initialize GitHub App
	const app = new App({
		appId: requireEnv("GITHUB_APP_ID"),
		privateKey: await loadPrivateKey(),
	});

	const installationId = Number(requireEnv("GITHUB_APP_INSTALLATION_ID"));

	// Get an authenticated Octokit instance for the installation
	const installationOctokit = await app.getInstallationOctokit(installationId);
	const installationAuth = (await app.octokit.auth({
		type: "installation",
		installationId,
	})) as GitHubInstallationAuth;
	const installationToken = installationAuth.token;

	// Step 1: Create GitHub repo
	const { repoId, cloneUrl, owner, ownerId } = await createGitHubRepo(
		installationOctokit,
		repoName,
		org,
		isPrivate,
	);

	// Step 2: Push template code to GitHub
	await pushToGitHub(cloneUrl, installationToken, workerName);

	// Step 3: Upload a minimal Worker script so Cloudflare assigns the Worker tag required by Builds
	await uploadPlaceholderWorker(workerName);

	// Step 4: Connect repo to Cloudflare
	const repoConnectionUuid = await connectRepoToCloudflare(
		repoId,
		repoName,
		owner,
		ownerId,
	);

	// Step 5: Get worker tag + create auto-deploy trigger
	const workerTag = await getWorkerTag(workerName);
	const triggerUuid = await createBuildTrigger(
		workerTag,
		repoConnectionUuid,
		workerName,
	);
	const buildUuid = await triggerBuild(triggerUuid);

	const domains = await provisionDomainForWorker(
		workerName,
		domain,
		domainPreflight,
	);

	// Final result
	const result: PipelineResult = {
		github: { repoName, repoUrl: cloneUrl, repoId, owner, ownerId },
		cloudflare: {
			workerName,
			workerUrl: `https://${workerName}.${process.env.CLOUDFLARE_SUBDOMAIN ?? "workers"}.workers.dev`,
			workerTag,
			repoConnectionUuid,
			triggerUuid,
			buildUuid,
			domains,
		},
	};

	console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(`✅ All done! Funnel site is live and auto-deploying.`);
	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(JSON.stringify(result, null, 2));
	console.log(
		`\n💾 Save this output to your database. The initial Cloudflare-hosted build has started, and future pushes to "main" will auto-deploy.\n`,
	);

	return result;
}

if (import.meta.main) {
	main().catch((err) => {
		if (err instanceof UsageError) {
			console.error(err.message);
		} else {
			console.error(`\n❌ Pipeline failed:`, err.message);
		}
		process.exit(1);
	});
}
