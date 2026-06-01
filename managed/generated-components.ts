import type { ComponentType } from "react";

type EmptyProps = Record<string, never>;

export type GeneratedComponentDefinition = {
	id: string;
	displayName: string;
	Component: ComponentType<EmptyProps>;
	propsSchema: {
		safeParse: (value: unknown) => { success: true; data: EmptyProps };
	};
	allowedSlots?: readonly string[];
};

export const emptyPropsSchema: GeneratedComponentDefinition["propsSchema"] = {
	safeParse(): { success: true; data: EmptyProps } {
		return { success: true, data: {} as EmptyProps };
	},
};

export function defineGeneratedComponent<
	const Definition extends GeneratedComponentDefinition,
>(definition: Definition): Definition {
	return definition;
}
