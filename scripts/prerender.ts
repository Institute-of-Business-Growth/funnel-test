import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface StaticRoute {
	path: string;
}

interface RenderResult {
	html: string;
	title: string;
	description: string;
	noIndex: boolean;
}

interface ServerEntry {
	getStaticRoutes: () => StaticRoute[];
	render: (path: string) => RenderResult;
}

const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = join(distDir, "index.html");
const serverEntryUrl = pathToFileURL(
	resolve(root, "dist-ssr/entry-server.mjs"),
).href;

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function outputPathForRoute(path: string) {
	if (path === "/") {
		return join(distDir, "index.html");
	}

	if (path === "/404") {
		return join(distDir, "404.html");
	}

	return join(distDir, path.replace(/^\/+/, ""), "index.html");
}

function injectRoute(template: string, result: RenderResult) {
	return template
		.replace("<!--app-html-->", result.html)
		.replace(
			/<title>.*?<\/title>/s,
			`<title>${escapeHtml(result.title)}</title>`,
		)
		.replace(
			/<meta name="description" content="[^"]*" \/>/,
			`<meta name="description" content="${escapeHtml(result.description)}" />`,
		)
		.replace(
			/<meta name="robots" content="[^"]*" data-prerender-robots \/>/,
			result.noIndex
				? '<meta name="robots" content="noindex, nofollow" />'
				: '<meta name="robots" content="index, follow" />',
		);
}

const template = await readFile(templatePath, "utf8");
const serverEntry = (await import(serverEntryUrl)) as ServerEntry;

for (const route of serverEntry.getStaticRoutes()) {
	const result = serverEntry.render(route.path);
	const outputPath = outputPathForRoute(route.path);
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, injectRoute(template, result));
	console.log(`prerendered ${route.path} -> ${outputPath}`);
}
