import { type FormEvent, useState } from "react";
import type { LeadFormBlockProps } from "./block-types";
import {
	getRuntimeUtm,
	postRuntimeEvent,
	runtimeConfig,
} from "./runtime-client";

function resolveLeadInputType(fieldId: string) {
	if (fieldId === "email") {
		return "email";
	}

	if (fieldId === "phone") {
		return "tel";
	}

	return "text";
}

function formatLeadLabel(fieldId: string) {
	return fieldId
		.split("-")
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function renderLeadField(field: LeadFormBlockProps["fields"][number]) {
	const fieldId = typeof field === "string" ? field : field.id;
	const label =
		typeof field === "string" ? formatLeadLabel(field) : field.label;

	if (typeof field !== "string" && field.type === "textarea") {
		return (
			<label className="grid gap-2" key={fieldId}>
				<span className="text-sm font-medium">{label}</span>
				<textarea
					className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
					name={fieldId}
				/>
			</label>
		);
	}

	if (typeof field !== "string" && field.type === "select") {
		const options = field.options ?? [];

		return (
			<label className="grid gap-2" key={fieldId}>
				<span className="text-sm font-medium">{label}</span>
				<select
					className="rounded-md border border-input bg-background px-3 py-2 text-sm"
					name={fieldId}
				>
					{options.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			</label>
		);
	}

	return (
		<label className="grid gap-2" key={fieldId}>
			<span className="text-sm font-medium">{label}</span>
			<input
				className="rounded-md border border-input bg-background px-3 py-2 text-sm"
				name={fieldId}
				required={fieldId === "email"}
				type={resolveLeadInputType(fieldId)}
			/>
		</label>
	);
}

export function LeadFormBlock(props: LeadFormBlockProps) {
	const [status, setStatus] = useState<
		"idle" | "submitting" | "submitted" | "error"
	>("idle");

	async function submitLead(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus("submitting");
		const formData = new FormData(event.currentTarget);
		const fields = Object.fromEntries(formData.entries());

		try {
			const sourcePath = props.routePath ?? window.location.pathname;
			const utm = getRuntimeUtm();
			await postRuntimeEvent({
				websiteId: runtimeConfig.websiteId,
				runtimeToken: runtimeConfig.runtimeToken,
				path: "/leads",
				body: {
					fields,
					formId: props.formId,
					sourcePath,
					...(utm ? { utm } : {}),
					...(props.funnelStepId ? { funnelStepId: props.funnelStepId } : {}),
					...(typeof props.funnelRevision === "number"
						? { funnelRevision: props.funnelRevision }
						: {}),
					...(props.routePath ? { routePath: props.routePath } : {}),
				},
			});
			setStatus("submitted");
		} catch {
			setStatus("error");
		}
	}

	if (status === "submitted") {
		return (
			<section className="px-4 py-12 md:px-8">
				<p className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 text-center font-medium">
					{props.successMessage ?? "Thanks. We received your details."}
				</p>
			</section>
		);
	}

	return (
		<section className="px-4 py-12 md:px-8">
			<form
				className="mx-auto grid max-w-2xl gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
				onSubmit={submitLead}
			>
				{props.title ? (
					<h2 className="text-2xl font-semibold tracking-tight">
						{props.title}
					</h2>
				) : null}
				{props.fields.map((field) => renderLeadField(field))}
				<button
					className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
					disabled={status === "submitting"}
					type="submit"
				>
					{status === "submitting"
						? "Submitting..."
						: (props.submitText ?? "Submit")}
				</button>
				{status === "error" ? (
					<p className="text-sm text-destructive" role="alert">
						Unable to submit. Please try again.
					</p>
				) : null}
			</form>
		</section>
	);
}
