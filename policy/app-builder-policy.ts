import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { validateManagedPageDocument } from "../managed/block-schemas";

type Finding = {
	code: string;
	message: string;
	path?: string;
	value?: string;
	line?: number;
	column?: number;
};

const rootDir = process.cwd();

const ignoredDirectories = new Set([
	".git",
	".next",
	".turbo",
	".vite",
	"build",
	"dist",
	"dist-ssr",
	"node_modules",
	"out",
]);
const ignoredFileNames = new Set([".DS_Store"]);
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const inspectableStaticTextExtensions = new Set([
	".css",
	".htm",
	".html",
	".svg",
]);
const blockedPublicAssetExtensions = new Set([
	".cjs",
	".htm",
	".html",
	".js",
	".jsx",
	".mjs",
	".ts",
	".tsx",
]);

const blockedImportPrefixes = [
	"@auth/",
	"@clerk/",
	"@firebase/",
	"@neondatabase/",
	"@planetscale/",
	"@redis/",
	"@stripe/",
	"@supabase/",
	"@upstash/",
	"@vercel/kv",
	"@vercel/postgres",
	"@whop/",
	"better-auth/",
	"child_process/",
	"crypto/",
	"dns/",
	"firebase/",
	"fs/",
	"http/",
	"http2/",
	"https/",
	"net/",
	"next-auth/",
	"node:child_process/",
	"node:crypto/",
	"node:dns/",
	"node:fs/",
	"node:http/",
	"node:http2/",
	"node:https/",
	"node:net/",
	"node:os/",
	"node:path/",
	"node:process/",
	"node:tls/",
	"node:vm/",
	"node:worker_threads/",
	"os/",
	"path/",
	"process/",
	"tls/",
	"vm/",
	"worker_threads/",
];

const blockedImportExact = new Set([
	"@neondatabase/serverless",
	"@planetscale/database",
	"@upstash/redis",
	"@vercel/kv",
	"@vercel/postgres",
	"@whop/sdk",
	"better-auth",
	"better-sqlite3",
	"child_process",
	"crypto",
	"dns",
	"drizzle-orm",
	"firebase",
	"firebase-admin",
	"fs",
	"http",
	"http2",
	"https",
	"ioredis",
	"mongodb",
	"mongoose",
	"mysql",
	"mysql2",
	"net",
	"next-auth",
	"next/script",
	"node:child_process",
	"node:crypto",
	"node:dns",
	"node:fs",
	"node:http",
	"node:http2",
	"node:https",
	"node:net",
	"node:os",
	"node:path",
	"node:process",
	"node:tls",
	"node:vm",
	"node:worker_threads",
	"os",
	"path",
	"pg",
	"postgres",
	"prisma",
	"process",
	"redis",
	"server-only",
	"sqlite3",
	"stripe",
	"supabase",
	"tls",
	"vm",
	"worker_threads",
]);

const directManagedComponents = new Set([
	"CheckoutBlock",
	"UpsellBlock",
	"LeadFormBlock",
	"OfferDisplayBlock",
	"VideoEmbedBlock",
	"AnalyticsBridge",
]);
const blockedNetworkConstructors = new Set([
	"EventSource",
	"WebSocket",
	"XMLHttpRequest",
]);
const blockedExternalServiceHosts = [
	"analytics.google.com",
	"connect.facebook.net",
	"facebook.com",
	"googletagmanager.com",
	"google-analytics.com",
	"mixpanel.com",
	"plausible.io",
	"posthog.cloud",
	"posthog.com",
	"segment.com",
	"segment.io",
	"stripe.com",
	"supabase.co",
	"supabase.com",
	"whop.com",
];

const allowedRootFiles = new Set([
	".env.example",
	".gitignore",
	"README.md",
	"app-builder.blocks.json",
	"app-builder.manifest.ts",
	"app-builder.registry.ts",
	"biome.json",
	"biome.jsonc",
	"bun.lock",
	"bun.lockb",
	"components.json",
	"index.html",
	"package.json",
	"postcss.config.js",
	"postcss.config.mjs",
	"tsconfig.json",
	"vite.config.js",
	"vite.config.mjs",
	"vite.config.ts",
	"wrangler.jsonc",
	"wrangler.toml",
]);

function normalizePath(filePath: string) {
	return path
		.relative(
			rootDir,
			path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath),
		)
		.split(path.sep)
		.join("/");
}

function isInside(relativePath: string, directory: string) {
	return relativePath === directory || relativePath.startsWith(`${directory}/`);
}

function isBlockedPublicAssetPath(relativePath: string) {
	return (
		(isInside(relativePath, "public") || isInside(relativePath, "assets")) &&
		blockedPublicAssetExtensions.has(path.extname(relativePath).toLowerCase())
	);
}

function isLockedPath(relativePath: string) {
	return (
		relativePath.startsWith(".env") ||
		isInside(relativePath, ".github") ||
		isInside(relativePath, "managed") ||
		isInside(relativePath, "policy") ||
		isInside(relativePath, "worker") ||
		isInside(relativePath, "src/components/animations") ||
		isInside(relativePath, "src/components/ui") ||
		isInside(relativePath, "src/hooks") ||
		isInside(relativePath, "src/lib") ||
		relativePath === "app-builder.registry.ts" ||
		relativePath === "bun.lock" ||
		relativePath === "bun.lockb" ||
		relativePath === "components.json" ||
		relativePath === "index.html" ||
		relativePath === "package.json" ||
		relativePath === "postcss.config.mjs" ||
		relativePath === "tsconfig.json" ||
		relativePath === "wrangler.jsonc" ||
		relativePath.startsWith("vite.config.")
	);
}

function isAgentEditablePath(relativePath: string) {
	return (
		relativePath === "app-builder.blocks.json" ||
		relativePath === "app-builder.manifest.ts" ||
		isInside(relativePath, "components/generated") ||
		isInside(relativePath, "components/sections") ||
		isInside(relativePath, "src") ||
		(isInside(relativePath, "public") &&
			!isBlockedPublicAssetPath(relativePath)) ||
		(isInside(relativePath, "assets") &&
			!isBlockedPublicAssetPath(relativePath))
	);
}

function isTemplateSupportPath(relativePath: string) {
	return (
		allowedRootFiles.has(relativePath) ||
		isInside(relativePath, "managed") ||
		isInside(relativePath, "policy") ||
		isInside(relativePath, "scripts") ||
		isInside(relativePath, "worker") ||
		isInside(relativePath, "src") ||
		(isInside(relativePath, "public") &&
			!isBlockedPublicAssetPath(relativePath)) ||
		(isInside(relativePath, "assets") &&
			!isBlockedPublicAssetPath(relativePath))
	);
}

function isAllowedRepositoryPath(relativePath: string) {
	return (
		isAgentEditablePath(relativePath) || isTemplateSupportPath(relativePath)
	);
}

function isCodeFile(relativePath: string) {
	return codeExtensions.has(path.extname(relativePath));
}

function isInspectableStaticTextFile(relativePath: string) {
	return inspectableStaticTextExtensions.has(
		path.extname(relativePath).toLowerCase(),
	);
}

function listFiles(directory = rootDir): string[] {
	const output: string[] = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const absolutePath = path.join(directory, entry.name);
		const relativePath = normalizePath(absolutePath);

		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				output.push(...listFiles(absolutePath));
			}
			continue;
		}

		if (
			entry.isFile() &&
			!ignoredFileNames.has(entry.name) &&
			!entry.name.endsWith(".tsbuildinfo") &&
			!(entry.name.startsWith(".env") && entry.name !== ".env.example")
		) {
			output.push(relativePath);
		}
	}

	return output.sort((first, second) => first.localeCompare(second));
}

function lineColumn(sourceFile: ts.SourceFile, node: ts.Node) {
	const position = sourceFile.getLineAndCharacterOfPosition(
		node.getStart(sourceFile),
	);

	return {
		line: position.line + 1,
		column: position.character + 1,
	};
}

function withLocation(
	finding: Finding,
	sourceFile: ts.SourceFile,
	node: ts.Node,
): Finding {
	return { ...finding, ...lineColumn(sourceFile, node) };
}

function isBlockedImport(moduleName: string) {
	return (
		blockedImportExact.has(moduleName) ||
		blockedImportPrefixes.some((prefix) => moduleName.startsWith(prefix))
	);
}

function getImportedNames(node: ts.ImportDeclaration) {
	const names = new Set<string>();
	const importClause = node.importClause;
	if (!importClause) {
		return names;
	}
	if (importClause.name) {
		names.add(importClause.name.text);
	}
	const namedBindings = importClause.namedBindings;
	if (!namedBindings) {
		return names;
	}
	if (ts.isNamespaceImport(namedBindings)) {
		names.add(namedBindings.name.text);
		return names;
	}
	for (const element of namedBindings.elements) {
		names.add(element.name.text);
		if (element.propertyName) {
			names.add(element.propertyName.text);
		}
	}
	return names;
}

function isManagedImportPath(moduleName: string) {
	const normalized = moduleName.replaceAll("\\", "/");
	return (
		normalized === "managed" ||
		normalized.includes("/managed") ||
		normalized.startsWith("managed/")
	);
}

function isAllowedManagedImportPath(moduleName: string, relativePath: string) {
	const normalized = moduleName
		.replaceAll("\\", "/")
		.replace(/\.(tsx?|jsx?)$/, "");

	if (
		normalized === "managed/ManagedBlocksRenderer" ||
		normalized.endsWith("/managed/ManagedBlocksRenderer")
	) {
		return true;
	}

	return (
		relativePath === "app-builder.manifest.ts" &&
		(normalized === "managed/generated-components" ||
			normalized.endsWith("/managed/generated-components"))
	);
}

function getCriticalManagedComponentFromPath(moduleName: string) {
	const normalized = moduleName.replaceAll("\\", "/");
	for (const componentName of directManagedComponents) {
		if (
			normalized.endsWith(`/managed/${componentName}`) ||
			normalized.endsWith(`managed/${componentName}`) ||
			normalized.endsWith(`/managed/${componentName}.tsx`) ||
			normalized.endsWith(`/managed/${componentName}.ts`)
		) {
			return componentName;
		}
	}

	return null;
}

function getStringArgument(node: ts.CallExpression) {
	const [argument] = node.arguments;
	if (
		argument &&
		(ts.isStringLiteral(argument) ||
			ts.isNoSubstitutionTemplateLiteral(argument))
	) {
		return argument.text;
	}

	return null;
}

function getStaticElementAccessName(expression: ts.ElementAccessExpression) {
	const argument = expression.argumentExpression;
	if (
		argument &&
		(ts.isStringLiteral(argument) ||
			ts.isNoSubstitutionTemplateLiteral(argument))
	) {
		return argument.text;
	}

	return null;
}

function getStaticPropertyAccess(expression: ts.Expression) {
	if (ts.isPropertyAccessExpression(expression)) {
		return { object: expression.expression, name: expression.name.text };
	}

	if (ts.isElementAccessExpression(expression)) {
		const name = getStaticElementAccessName(expression);
		if (name) {
			return { object: expression.expression, name };
		}
	}

	return null;
}

function isGlobalFetchExpression(expression: ts.Expression) {
	if (ts.isIdentifier(expression)) {
		return expression.text === "fetch";
	}

	const access = getStaticPropertyAccess(expression);
	return Boolean(
		access?.name === "fetch" &&
			ts.isIdentifier(access.object) &&
			["window", "globalThis", "self"].includes(access.object.text),
	);
}

function isNavigatorSendBeaconExpression(expression: ts.Expression) {
	const access = getStaticPropertyAccess(expression);
	if (access?.name !== "sendBeacon") {
		return false;
	}
	if (ts.isIdentifier(access.object)) {
		return access.object.text === "navigator";
	}
	const navigatorAccess = getStaticPropertyAccess(access.object);
	return Boolean(
		navigatorAccess?.name === "navigator" &&
			ts.isIdentifier(navigatorAccess.object) &&
			["globalThis", "window"].includes(navigatorAccess.object.text),
	);
}

function getStaticStringFragment(node: ts.Node) {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	if (
		node.kind === ts.SyntaxKind.TemplateHead ||
		node.kind === ts.SyntaxKind.TemplateMiddle ||
		node.kind === ts.SyntaxKind.TemplateTail
	) {
		return (node as ts.TemplateLiteralLikeNode).text;
	}

	return null;
}

function getBlockedExternalServiceHost(value: string) {
	const lowerValue = value.toLowerCase();
	const literalMatch = blockedExternalServiceHosts.find((host) =>
		lowerValue.includes(host),
	);
	if (literalMatch) {
		return literalMatch;
	}
	if (!/^https?:\/\//i.test(value.trim())) {
		return null;
	}
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return (
			blockedExternalServiceHosts.find(
				(host) => hostname === host || hostname.endsWith(`.${host}`),
			) ?? null
		);
	} catch {
		return null;
	}
}

function getJsxTagName(tagName: ts.JsxTagNameExpression) {
	if (ts.isIdentifier(tagName)) {
		return tagName.text;
	}
	if (ts.isPropertyAccessExpression(tagName)) {
		return tagName.name.text;
	}
	return null;
}

function isRawElementFactoryCall(node: ts.CallExpression) {
	const elementName = getStringArgument(node);
	if (!(elementName === "script" || elementName === "iframe")) {
		return false;
	}
	const access = getStaticPropertyAccess(node.expression);
	if (access?.name !== "createElement") {
		return (
			ts.isIdentifier(node.expression) &&
			node.expression.text === "createElement"
		);
	}
	return (
		(ts.isIdentifier(access.object) &&
			["React", "document"].includes(access.object.text)) ||
		ts.isPropertyAccessExpression(access.object) ||
		ts.isElementAccessExpression(access.object)
	);
}

function isProcessUsage(node: ts.Node) {
	return ts.isIdentifier(node) && node.text === "process";
}

function inspectSourceFile(sourceFile: ts.SourceFile, relativePath: string) {
	const findings: Finding[] = [];

	function visit(node: ts.Node) {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			const moduleName = node.moduleSpecifier.text;
			if (isBlockedImport(moduleName)) {
				findings.push(
					withLocation(
						{
							code: "blocked_import",
							message: `Generated code may not import ${moduleName}`,
							path: relativePath,
							value: moduleName,
						},
						sourceFile,
						node,
					),
				);
			}

			const criticalComponent = getCriticalManagedComponentFromPath(moduleName);
			if (criticalComponent) {
				findings.push(
					withLocation(
						{
							code: "blocked_direct_managed_component",
							message: `Generated code must use ManagedBlocksRenderer instead of importing ${criticalComponent}`,
							path: relativePath,
							value: criticalComponent,
						},
						sourceFile,
						node,
					),
				);
			}

			if (isManagedImportPath(moduleName)) {
				if (!isAllowedManagedImportPath(moduleName, relativePath)) {
					findings.push(
						withLocation(
							{
								code: "blocked_import",
								message:
									"Generated code may only import ManagedBlocksRenderer from managed runtime files",
								path: relativePath,
								value: moduleName,
							},
							sourceFile,
							node,
						),
					);
				}
				for (const importedName of getImportedNames(node)) {
					if (directManagedComponents.has(importedName)) {
						findings.push(
							withLocation(
								{
									code: "blocked_direct_managed_component",
									message: `Generated code must use ManagedBlocksRenderer instead of importing ${importedName}`,
									path: relativePath,
									value: importedName,
								},
								sourceFile,
								node,
							),
						);
					}
				}
			}
		}

		if (isProcessUsage(node)) {
			findings.push(
				withLocation(
					{
						code: "blocked_process_usage",
						message: "Generated code may not use process",
						path: relativePath,
						value: "process",
					},
					sourceFile,
					node,
				),
			);
		}

		if (
			ts.isExpressionStatement(node) &&
			ts.isStringLiteral(node.expression) &&
			node.expression.text === "use server"
		) {
			findings.push(
				withLocation(
					{
						code: "generated_server_action",
						message: "Generated code may not define server actions",
						path: relativePath,
						value: "use server",
					},
					sourceFile,
					node,
				),
			);
		}

		if (ts.isCallExpression(node)) {
			if (isGlobalFetchExpression(node.expression)) {
				findings.push(
					withLocation(
						{
							code: "blocked_fetch",
							message:
								"Generated code must use managed runtime APIs instead of raw fetch",
							path: relativePath,
							value: "fetch",
						},
						sourceFile,
						node,
					),
				);
			}
			if (isNavigatorSendBeaconExpression(node.expression)) {
				findings.push(
					withLocation(
						{
							code: "blocked_fetch",
							message:
								"Generated code must use managed runtime APIs instead of raw beacon requests",
							path: relativePath,
							value: "sendBeacon",
						},
						sourceFile,
						node,
					),
				);
			}

			const moduleName = getStringArgument(node);
			const isRequireCall =
				ts.isIdentifier(node.expression) && node.expression.text === "require";
			const isDynamicImport =
				node.expression.kind === ts.SyntaxKind.ImportKeyword;
			if ((isRequireCall || isDynamicImport) && !moduleName) {
				findings.push(
					withLocation(
						{
							code: "blocked_dynamic_code",
							message:
								"Generated code may not use non-static dynamic imports or require calls",
							path: relativePath,
							value: isDynamicImport ? "import" : "require",
						},
						sourceFile,
						node,
					),
				);
			}
			if (
				moduleName &&
				(isRequireCall || isDynamicImport) &&
				isBlockedImport(moduleName)
			) {
				findings.push(
					withLocation(
						{
							code: "blocked_import",
							message: `Generated code may not import ${moduleName}`,
							path: relativePath,
							value: moduleName,
						},
						sourceFile,
						node,
					),
				);
			}
			if (isRawElementFactoryCall(node)) {
				findings.push(
					withLocation(
						{
							code: "blocked_jsx_element",
							message:
								"Generated code may not create raw script or iframe elements",
							path: relativePath,
							value: getStringArgument(node) ?? undefined,
						},
						sourceFile,
						node,
					),
				);
			}
			if (
				ts.isIdentifier(node.expression) &&
				(node.expression.text === "eval" || node.expression.text === "Function")
			) {
				findings.push(
					withLocation(
						{
							code: "blocked_dynamic_code",
							message: "Generated code may not evaluate dynamic code",
							path: relativePath,
							value: node.expression.text,
						},
						sourceFile,
						node,
					),
				);
			}
		}

		if (
			ts.isNewExpression(node) &&
			ts.isIdentifier(node.expression) &&
			(node.expression.text === "Function" ||
				blockedNetworkConstructors.has(node.expression.text))
		) {
			findings.push(
				withLocation(
					{
						code:
							node.expression.text === "Function"
								? "blocked_dynamic_code"
								: "blocked_fetch",
						message:
							node.expression.text === "Function"
								? "Generated code may not evaluate dynamic code"
								: "Generated code must use managed runtime APIs instead of raw network clients",
						path: relativePath,
						value: node.expression.text,
					},
					sourceFile,
					node,
				),
			);
		}

		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			const tagName = getJsxTagName(node.tagName);
			if (
				tagName === "script" ||
				tagName === "iframe" ||
				tagName === "Script"
			) {
				findings.push(
					withLocation(
						{
							code: "blocked_jsx_element",
							message: `Generated code may not render raw <${tagName}> elements`,
							path: relativePath,
							value: tagName,
						},
						sourceFile,
						node,
					),
				);
			}
			if (tagName && directManagedComponents.has(tagName)) {
				findings.push(
					withLocation(
						{
							code: "blocked_direct_managed_component",
							message: `Generated code must use ManagedBlocksRenderer instead of rendering ${tagName}`,
							path: relativePath,
							value: tagName,
						},
						sourceFile,
						node,
					),
				);
			}
			for (const attribute of node.attributes.properties) {
				if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) {
					continue;
				}
				if (attribute.name.text === "dangerouslySetInnerHTML") {
					findings.push(
						withLocation(
							{
								code: "blocked_dangerous_html",
								message: "Generated code may not use dangerouslySetInnerHTML",
								path: relativePath,
								value: "dangerouslySetInnerHTML",
							},
							sourceFile,
							attribute,
						),
					);
				}
				if (
					(tagName === "form" && attribute.name.text === "action") ||
					attribute.name.text === "formAction"
				) {
					findings.push(
						withLocation(
							{
								code: "blocked_fetch",
								message:
									"Generated code must use managed lead forms instead of raw form actions",
								path: relativePath,
								value: attribute.name.text,
							},
							sourceFile,
							attribute,
						),
					);
				}
			}
		}

		const staticStringFragment = getStaticStringFragment(node);
		if (staticStringFragment !== null) {
			const lowerValue = staticStringFragment.toLowerCase();
			if (lowerValue.includes("<iframe") || lowerValue.includes("<script")) {
				findings.push(
					withLocation(
						{
							code: "blocked_raw_markup",
							message:
								"Generated code may not contain raw iframe or script markup",
							path: relativePath,
							value: lowerValue.includes("<iframe") ? "<iframe" : "<script",
						},
						sourceFile,
						node,
					),
				);
			}
			const blockedHost = getBlockedExternalServiceHost(staticStringFragment);
			if (blockedHost) {
				findings.push(
					withLocation(
						{
							code: "blocked_external_service_url",
							message:
								"Generated code must use managed integrations instead of raw external service URLs",
							path: relativePath,
							value: blockedHost,
						},
						sourceFile,
						node,
					),
				);
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return findings;
}

function inspectCodeFile(relativePath: string) {
	const sourceText = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
	const scriptKind =
		relativePath.endsWith(".tsx") || relativePath.endsWith(".jsx")
			? ts.ScriptKind.TSX
			: ts.ScriptKind.TS;
	const sourceFile = ts.createSourceFile(
		relativePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		scriptKind,
	);

	return inspectSourceFile(sourceFile, relativePath);
}

function inspectStaticTextFile(relativePath: string) {
	const sourceText = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
	const findings: Finding[] = [];
	const lowerSourceText = sourceText.toLowerCase();
	if (
		lowerSourceText.includes("<iframe") ||
		lowerSourceText.includes("<script")
	) {
		findings.push({
			code: "blocked_raw_markup",
			message: "Generated assets may not contain raw iframe or script markup",
			path: relativePath,
			value: lowerSourceText.includes("<iframe") ? "<iframe" : "<script",
		});
	}
	const blockedHost = getBlockedExternalServiceHost(sourceText);
	if (blockedHost) {
		findings.push({
			code: "blocked_external_service_url",
			message:
				"Generated assets must use managed integrations instead of raw external service URLs",
			path: relativePath,
			value: blockedHost,
		});
	}
	if (path.extname(relativePath).toLowerCase() === ".svg") {
		if (/\s+on[a-z0-9-]+\s*=/i.test(sourceText)) {
			findings.push({
				code: "blocked_svg_markup",
				message: "Generated SVG assets may not contain event handlers",
				path: relativePath,
				value: "event-handler",
			});
		}
		if (
			/\b(?:href|xlink:href|src)\s*=\s*["']?\s*javascript:/i.test(sourceText)
		) {
			findings.push({
				code: "blocked_svg_markup",
				message: "Generated SVG assets may not contain javascript URLs",
				path: relativePath,
				value: "javascript-url",
			});
		}
	}

	return findings;
}

function validateManagedBlocks() {
	const relativePath = "app-builder.blocks.json";
	const absolutePath = path.join(rootDir, relativePath);
	if (!fs.existsSync(absolutePath)) {
		return [
			{
				code: "missing_managed_blocks",
				message: "Generated sites must include app-builder.blocks.json",
				path: relativePath,
			},
		];
	}

	try {
		const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
		const result = validateManagedPageDocument(parsed);
		if (result.success) {
			return [];
		}
		return result.issues.map((issue) => ({
			code: "invalid_managed_blocks",
			message: issue,
			path: relativePath,
		}));
	} catch (error) {
		return [
			{
				code: "invalid_managed_blocks_json",
				message: error instanceof Error ? error.message : "Invalid JSON",
				path: relativePath,
			},
		];
	}
}

function validateGeneratedManifest(files: readonly string[]) {
	const findings: Finding[] = [];
	const manifestPath = "app-builder.manifest.ts";
	const manifest = fs.existsSync(path.join(rootDir, manifestPath))
		? fs.readFileSync(path.join(rootDir, manifestPath), "utf8")
		: null;

	if (!manifest) {
		return [
			{
				code: "missing_generated_manifest",
				message: "Generated sites must include app-builder.manifest.ts",
				path: manifestPath,
			},
		];
	}
	if (!manifest.includes("defineGeneratedComponent")) {
		findings.push({
			code: "invalid_generated_manifest",
			message:
				"Generated components must be registered with defineGeneratedComponent",
			path: manifestPath,
		});
	}

	for (const file of files) {
		if (
			isInside(file, "components/generated") &&
			codeExtensions.has(path.extname(file))
		) {
			const withoutExtension = file.replace(/\.(tsx?|jsx?)$/, "");
			if (!manifest.includes(withoutExtension)) {
				findings.push({
					code: "unregistered_generated_component",
					message: `Generated component file ${file} must be registered in app-builder.manifest.ts`,
					path: file,
					value: file,
				});
			}
		}
	}

	return findings;
}

function validateChangedFiles() {
	const changedFiles = process.argv.slice(2);
	const findings: Finding[] = [];
	for (const filePath of changedFiles) {
		const relativePath = normalizePath(filePath);
		if (isLockedPath(relativePath)) {
			findings.push({
				code: "locked_path_edit",
				message: `Agent runs may not edit locked path ${relativePath}`,
				path: relativePath,
				value: relativePath,
			});
			continue;
		}
		if (!isAgentEditablePath(relativePath)) {
			findings.push({
				code: "unsupported_path_edit",
				message: `Agent runs may not edit unsupported path ${relativePath}`,
				path: relativePath,
				value: relativePath,
			});
		}
	}

	return findings;
}

function runPolicy() {
	const findings: Finding[] = [...validateManagedBlocks()];
	const files = listFiles();

	findings.push(...validateGeneratedManifest(files));

	for (const relativePath of files) {
		if (!isAllowedRepositoryPath(relativePath)) {
			findings.push({
				code: "unsupported_path",
				message: `Generated repository may not contain unsupported path ${relativePath}`,
				path: relativePath,
				value: relativePath,
			});
		}

		if (!isAgentEditablePath(relativePath)) {
			continue;
		}
		if (isCodeFile(relativePath)) {
			findings.push(...inspectCodeFile(relativePath));
		} else if (isInspectableStaticTextFile(relativePath)) {
			findings.push(...inspectStaticTextFile(relativePath));
		}
	}

	findings.push(...validateChangedFiles());

	if (findings.length === 0) {
		process.stdout.write("app-builder policy passed\n");
		return;
	}

	process.stderr.write("app-builder policy failed\n");
	for (const finding of findings) {
		const location =
			finding.path && finding.line
				? `${finding.path}:${finding.line}:${finding.column ?? 1}`
				: finding.path;
		process.stderr.write(
			`${finding.code}${location ? ` ${location}` : ""}: ${finding.message}`,
		);
		process.stderr.write("\n");
	}
	process.exit(1);
}

runPolicy();
