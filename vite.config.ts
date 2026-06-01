import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	envPrefix: ["VITE_", "NEXT_PUBLIC_"],
	publicDir: "public",
	server: {
		allowedHosts: [".vercel.run", ".workers.dev"],
	},
	preview: {
		allowedHosts: [".vercel.run", ".workers.dev"],
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
		dedupe: ["react", "react-dom", "react/jsx-runtime"],
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: "react-vendor",
							test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
							priority: 50,
						},
						{
							name: "motion-vendor",
							test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/,
							priority: 40,
						},
						{
							name: "radix-vendor",
							test: /node_modules[\\/]@radix-ui[\\/]/,
							priority: 30,
						},
						{
							name: "ui-vendor",
							test: /node_modules[\\/](lucide-react|class-variance-authority|clsx|tailwind-merge|svg-dotted-map)[\\/]/,
							priority: 20,
						},
					],
				},
			},
		},
	},
});
