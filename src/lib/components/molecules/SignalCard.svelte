<script lang="ts">
	import type { Component } from 'svelte';

	type Props = {
		icon: Component;
		label: string;
		rule?: string;
		value?: string;
		valueSuffix?: string;
		alert?: 'danger' | 'warn' | 'ok' | null;
		progress?: number;
		progressColor?: 'blue' | 'cyan' | 'commerce' | 'emerald';
		children?: import('svelte').Snippet;
	};

	let {
		icon: Icon,
		label,
		rule,
		value,
		valueSuffix,
		alert = null,
		progress,
		progressColor = 'blue',
		children
	}: Props = $props();

	const alertStyles = {
		danger: 'border-commerce/30 bg-commerce/[0.03]',
		warn: 'border-amber-400/40 bg-amber-50/60',
		ok: 'border-emerald-500/30 bg-emerald-50/60'
	} as const;

	const defaultStyle = 'border-black/5 bg-white';

	const iconAlertStyles = {
		danger: 'bg-commerce/10 text-commerce',
		warn: 'bg-amber-400/15 text-amber-700',
		ok: 'bg-emerald-500/15 text-emerald-600'
	} as const;

	const defaultIconStyle = 'bg-playstation-blue/10 text-playstation-blue';

	const progressColorClass = {
		blue: 'bg-playstation-blue',
		cyan: 'bg-playstation-cyan',
		commerce: 'bg-commerce',
		emerald: 'bg-emerald-500'
	} as const;

	const wrapperClass = $derived(alert ? alertStyles[alert] : defaultStyle);
	const iconClass = $derived(alert ? iconAlertStyles[alert] : defaultIconStyle);
</script>

<article class={`rounded-lg border p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_3px_8px_rgba(0,0,0,0.06)] ${wrapperClass}`}>
	<header class="mb-2 flex items-center justify-between gap-2">
		<div class="flex min-w-0 items-center gap-2">
			<span class={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${iconClass}`} aria-hidden="true">
				<Icon size={12} strokeWidth={2} />
			</span>
			<span class="font-mono text-[10px] uppercase tracking-[0.1em] text-body-gray">{label}</span>
			{#if rule}
				<span class="font-mono text-[9.5px] text-body-gray/70">{rule}</span>
			{/if}
		</div>
		{#if value !== undefined}
			<span class="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-ink">
				{value}{#if valueSuffix}<span class="ml-1 text-[10px] font-normal text-body-gray">{valueSuffix}</span>{/if}
			</span>
		{/if}
	</header>

	{#if progress !== undefined}
		<div class="h-1 overflow-hidden rounded-full bg-black/5">
			<div
				class={`h-full rounded-full transition-all duration-500 ${progressColorClass[progressColor]}`}
				style={`width: ${Math.max(0, Math.min(100, progress))}%`}
			></div>
		</div>
	{/if}

	{#if children}
		<div class={progress !== undefined ? 'mt-2 space-y-1' : 'space-y-1'}>
			{@render children()}
		</div>
	{/if}
</article>
