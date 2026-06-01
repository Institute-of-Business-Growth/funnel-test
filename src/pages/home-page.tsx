import blocks from "../../app-builder.blocks.json";
import { DfyWebsiteLanding } from "../../components/generated/DfyWebsiteLanding";
import { ManagedBlocksRenderer } from "../../managed/ManagedBlocksRenderer";

export function HomePage() {
	return (
		<main className="flex flex-col bg-[#f7f4ef] text-[#171412]">
			<ManagedBlocksRenderer document={blocks} slot="analytics" />
			<DfyWebsiteLanding />
			<section id="apply" className="border-t border-[#d9d1c3] bg-white py-16">
				<div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-[0.8fr_1.2fr] md:px-8">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b14d2f]">
							Apply
						</p>
						<h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
							Tell us what the site needs to sell.
						</h2>
						<p className="mt-4 max-w-xl text-base leading-7 text-[#655d53]">
							Share the offer, audience, proof, and launch goal so the build can
							be planned around the buying decision you want visitors to make.
						</p>
					</div>
					<ManagedBlocksRenderer document={blocks} slot="contact" />
				</div>
			</section>
			<section
				id="checkout"
				className="border-t border-[#d9d1c3] bg-[#171412] py-16 text-white"
			>
				<div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-2 md:px-8">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f3b37f]">
							Start
						</p>
						<h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
							Reserve your DFY website build.
						</h2>
						<p className="mt-4 max-w-xl text-base leading-7 text-white/70">
							Move from planning into production with one clear next step for
							scope, assets, checkout, and launch timing.
						</p>
					</div>
					<ManagedBlocksRenderer document={blocks} slot="pricing" />
				</div>
			</section>
		</main>
	);
}
