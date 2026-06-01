import { AgentHero } from "./components/generated/AgentHero";
import { DfyWebsiteLanding } from "./components/generated/DfyWebsiteLanding";
import {
	defineGeneratedComponent,
	emptyPropsSchema,
} from "./managed/generated-components";

export const generatedComponents = [
	defineGeneratedComponent({
		id: "agent-hero",
		displayName: "Starter Hero",
		Component: AgentHero,
		propsSchema: emptyPropsSchema,
		allowedSlots: ["hero"],
	}),
	defineGeneratedComponent({
		id: "dfy-website-landing",
		displayName: "DFY Website Landing",
		Component: DfyWebsiteLanding,
		propsSchema: emptyPropsSchema,
		allowedSlots: ["hero", "content"],
	}),
] as const;
