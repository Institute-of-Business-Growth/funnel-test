export function ThankYouPage() {
	return (
		<main className="grid min-h-screen place-items-center bg-[#f7f4ef] px-5 text-[#171412]">
			<section className="max-w-2xl rounded-md border border-[#d9d1c3] bg-white p-8 text-center shadow-sm">
				<p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b14d2f]">
					Next steps
				</p>
				<h1 className="mt-4 text-4xl font-semibold tracking-tight">
					Your DFY website request is in.
				</h1>
				<p className="mt-4 text-base leading-7 text-[#655d53]">
					The team will review your offer, audience, and assets, then map the
					homepage, lead capture, checkout, and launch checklist.
				</p>
				<a
					className="mt-8 inline-flex rounded-md bg-[#171412] px-5 py-3 text-sm font-semibold text-white"
					href="/"
				>
					Back to homepage
				</a>
			</section>
		</main>
	);
}
