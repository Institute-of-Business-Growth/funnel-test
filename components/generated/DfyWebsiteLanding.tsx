const proofItems = [
	"Homepage copy",
	"Lead capture",
	"Checkout",
	"Launch QA",
] as const;

const processSteps = [
	{
		title: "Position",
		description:
			"We turn the offer, audience, guarantee, and proof into a clear buying argument.",
	},
	{
		title: "Build",
		description:
			"The page structure, visuals, and conversion sections are assembled for launch.",
	},
	{
		title: "Publish",
		description:
			"Your funnel is checked across desktop and mobile, then connected to the buying path.",
	},
] as const;

const deliverables = [
	"Conversion-focused homepage",
	"Mobile-first page system",
	"Lead form section",
	"Checkout section",
	"Thank-you page",
	"Launch checklist",
] as const;

export function DfyWebsiteLanding() {
	return (
		<>
			<header className="border-b border-[#d9d1c3] bg-[#f7f4ef]/95">
				<nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
					<a className="text-lg font-semibold tracking-tight" href="/">
						DFY Website Launch
					</a>
					<div className="hidden items-center gap-6 text-sm text-[#655d53] md:flex">
						<a href="#process">Process</a>
						<a href="#deliverables">Deliverables</a>
						<a href="#apply">Apply</a>
					</div>
					<a
						className="rounded-md bg-[#171412] px-4 py-2 text-sm font-semibold text-white"
						href="#checkout"
					>
						Start build
					</a>
				</nav>
			</header>

			<section className="border-b border-[#d9d1c3]">
				<div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-24">
					<div className="flex flex-col justify-center">
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b14d2f]">
							Done-for-you website funnel
						</p>
						<h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.96] tracking-tight md:text-7xl">
							DFY Website Launch
						</h1>
						<p className="mt-6 max-w-2xl text-lg leading-8 text-[#655d53]">
							A polished website funnel for service businesses that need the
							first page to explain the offer, earn trust, capture qualified
							leads, and move buyers into checkout.
						</p>
						<div className="mt-8 flex flex-col gap-3 sm:flex-row">
							<a
								className="rounded-md bg-[#b14d2f] px-5 py-3 text-center text-sm font-semibold text-white"
								href="#apply"
							>
								Request my build
							</a>
							<a
								className="rounded-md border border-[#b8ad9d] px-5 py-3 text-center text-sm font-semibold text-[#171412]"
								href="#process"
							>
								See the process
							</a>
						</div>
						<div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
							{proofItems.map((item) => (
								<div
									className="rounded-md border border-[#d9d1c3] bg-white px-3 py-3 text-sm font-medium text-[#2f2a25]"
									key={item}
								>
									{item}
								</div>
							))}
						</div>
					</div>

					<div className="relative">
						<div className="rounded-md border border-[#d9d1c3] bg-white p-4 shadow-sm">
							<img
								alt="Website funnel interface preview"
								className="aspect-[4/3] w-full rounded-md border border-[#e7dfd3] object-cover"
								src="/instant-integration.png"
							/>
							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								<div className="rounded-md bg-[#f7f4ef] p-4">
									<p className="text-3xl font-semibold">14d</p>
									<p className="mt-1 text-sm text-[#655d53]">Launch sprint</p>
								</div>
								<div className="rounded-md bg-[#102f2b] p-4 text-white">
									<p className="text-3xl font-semibold">1</p>
									<p className="mt-1 text-sm text-white/70">
										Clear conversion path
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section
				id="process"
				className="border-b border-[#d9d1c3] bg-white py-16"
			>
				<div className="mx-auto max-w-6xl px-5 md:px-8">
					<div className="max-w-2xl">
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b14d2f]">
							Process
						</p>
						<h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
							Built around the sales conversation.
						</h2>
					</div>
					<div className="mt-10 grid gap-4 md:grid-cols-3">
						{processSteps.map((step, index) => (
							<article
								className="rounded-md border border-[#d9d1c3] bg-[#fbfaf7] p-6"
								key={step.title}
							>
								<p className="text-sm font-semibold text-[#b14d2f]">
									0{index + 1}
								</p>
								<h3 className="mt-5 text-2xl font-semibold">{step.title}</h3>
								<p className="mt-3 leading-7 text-[#655d53]">
									{step.description}
								</p>
							</article>
						))}
					</div>
				</div>
			</section>

			<section id="deliverables" className="border-b border-[#d9d1c3] py-16">
				<div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2 md:px-8">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b14d2f]">
							Deliverables
						</p>
						<h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
							The essentials for a service offer that is ready to sell.
						</h2>
						<p className="mt-5 leading-7 text-[#655d53]">
							Each piece is designed to reduce uncertainty before the buyer
							books, applies, or purchases the service.
						</p>
					</div>
					<ul className="grid gap-3">
						{deliverables.map((deliverable) => (
							<li
								className="flex items-center justify-between rounded-md border border-[#d9d1c3] bg-white px-5 py-4 text-sm font-semibold"
								key={deliverable}
							>
								<span>{deliverable}</span>
								<span className="text-[#b14d2f]">Included</span>
							</li>
						))}
					</ul>
				</div>
			</section>

			<section className="bg-[#102f2b] py-16 text-white">
				<div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-[0.8fr_1.2fr] md:px-8">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f3b37f]">
							Proof
						</p>
						<h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
							Designed to make the next step obvious.
						</h2>
					</div>
					<blockquote className="rounded-md border border-white/15 bg-white/8 p-6">
						<p className="text-xl leading-8">
							“We stopped sending prospects to a generic homepage. This funnel
							explains the offer, qualifies the lead, and lets ready buyers move
							straight into the build.”
						</p>
						<footer className="mt-5 text-sm text-white/70">
							Launch lead, boutique service firm
						</footer>
					</blockquote>
				</div>
			</section>
		</>
	);
}
