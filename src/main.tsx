import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "@/App";
import "@/styles/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Missing root element");
}

if (rootElement.children.length > 0 || rootElement.textContent?.trim()) {
	hydrateRoot(rootElement, <App />);
} else {
	createRoot(rootElement).render(<App />);
}
