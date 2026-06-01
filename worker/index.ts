export default {
	async fetch(request: Request, env: { ASSETS: { fetch: typeof fetch } }) {
		const response = await env.ASSETS.fetch(request);
		if (response.status !== 404) {
			return response;
		}

		const url = new URL(request.url);
		if (url.pathname.startsWith("/api/")) {
			return response;
		}

		return env.ASSETS.fetch(new URL("/index.html", url.origin));
	},
};
