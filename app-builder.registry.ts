import { generatedComponents } from "./app-builder.manifest";
import { managedBlockRegistry } from "./managed/block-registry";

export const appBuilderRegistry = {
	generated: generatedComponents,
	managed: managedBlockRegistry,
} as const;
