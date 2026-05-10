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

	const alertBorder = {
		danger: 'border-commerce/40',
		warn: 'border-amber-400/40',
		ok: 'border-emerald-400/30'
	} as const;

	const defaultBorder = 'border-white/8';

	const progressColorClass = {
		blue: 'bg-playstation-blue',
		cyan: 'bg-playstation-cyan',
		commerce: 'bg-commerce',
		emerald: 'bg-emerald-400'
	} as const;

	const borderClass = $derived(alert ? alertBorder[alert] : defaultBorder);
</script>

<article class={`rounded-lg border bg-white/[0.03] p-3.5 ${borderClass}`}>
	<header class="mb-2 flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<span class="grid h-6 w-6 place-items-center rounded-md bg-white/10 text-white/80" aria-hidden="true">
				<Icon size={12} strokeWidth={2} />
			</span>
			<span class="font-mono text-[10px] uppercase tracking-[0.1em] text-white/60">{label}</span>
			{#if rule}
				<span class="font-mono text-[9.5px] text-white/30">{rule}</span>
			{/if}
		</div>
		{#if value !== undefined}
			<span class="font-mono text-[13px] font-semibold tabular-nums text-white">
				{value}{#if valueSuffix}<span class="ml-1 text-[10px] font-normal text-white/50">{valueSuffix}</span>{/if}
			</span>
		{/if}
	</header>

	{#if progress !== undefined}
		<div class="h-1 overflow-hidden rounded-full bg-white/5">
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
