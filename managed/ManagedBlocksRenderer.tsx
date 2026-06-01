import { managedBlockRegistry } from "./block-registry";
import {
	type ManagedBlock,
	type ManagedSlot,
	managedPageDocumentSchema,
} from "./block-schemas";

export function ManagedBlocksRenderer({
	document,
	slot,
}: {
	document: unknown;
	slot: string;
}) {
	const parsed = managedPageDocumentSchema.safeParse(document);
	if (!parsed.success) {
		return null;
	}

	const blocks: ManagedBlock[] = parsed.data.slots[slot as ManagedSlot] ?? [];

	return (
		<>
			{blocks.map((block, index) => {
				const Component = managedBlockRegistry[block.blockType];
				if (!Component) {
					return null;
				}

				return (
					<Component key={`${block.blockType}-${index}`} {...block.props} />
				);
			})}
		</>
	);
}
