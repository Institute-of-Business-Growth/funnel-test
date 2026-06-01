import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

const rootDir = process.cwd();

function allocatePort() {
	return new Promise<number>((resolvePort, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close(() => reject(new Error("Failed to allocate smoke port")));
				return;
			}
			const port = address.port;
			server.close(() => resolvePort(port));
		});
	});
}

function runCommand(command: string, args: string[]) {
	return new Promise<void>((resolveCommand, reject) => {
		const child = spawn(command, args, {
			cwd: rootDir,
			env: process.env,
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) {
				resolveCommand();
				return;
			}
			reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
		});
	});
}

async function waitForPreview(
	previewUrl: string,
	preview: ChildProcessWithoutNullStreams,
) {
	const startedAt = Date.now();
	let lastError = "preview did not respond";

	while (Date.now() - startedAt < 30_000) {
		if (preview.exitCode !== null) {
			throw new Error(`Preview exited before smoke check: ${preview.exitCode}`);
		}

		try {
			const response = await fetch(previewUrl);
			const body = await response.text();
			if (!response.ok) {
				lastError = `HTTP ${response.status}`;
			} else if (!body.includes('id="root"') && !body.includes("<main")) {
				lastError = "preview HTML did not contain the app shell";
			} else if (
				body.toLowerCase().includes("vite-error-overlay") ||
				body.toLowerCase().includes("internal server error")
			) {
				lastError = "preview rendered an error page";
			} else {
				return;
			}
		} catch (error) {
			lastError =
				error instanceof Error ? error.message : "preview unavailable";
		}

		await new Promise((resolveTimer) => setTimeout(resolveTimer, 400));
	}

	throw new Error(`Preview smoke test timed out: ${lastError}`);
}

async function main() {
	if (!existsSync(join(rootDir, "dist/index.html"))) {
		await runCommand("bun", ["run", "build"]);
	}

	const port = await allocatePort();
	const previewUrl = `http://127.0.0.1:${port}`;
	const preview = spawn(
		"bun",
		["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
		{
			cwd: rootDir,
			env: process.env,
			stdio: "pipe",
		},
	);

	preview.stdout.on("data", (chunk) => process.stdout.write(chunk));
	preview.stderr.on("data", (chunk) => process.stderr.write(chunk));

	try {
		await waitForPreview(previewUrl, preview);
		console.log(`preview smoke test passed at ${previewUrl}`);
	} finally {
		preview.kill("SIGTERM");
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
