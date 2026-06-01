export function NotFoundPage() {
	return (
		<main className="min-h-[70vh] pt-16">
			<section className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center">
				<p className="text-sm font-medium text-muted-foreground">404</p>
				<h1 className="max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
					Page not found
				</h1>
				<p className="max-w-md text-muted-foreground">
					The page you are looking for does not exist.
				</p>
				<a
					href="/"
					className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Back home
				</a>
			</section>
		</main>
	);
}
