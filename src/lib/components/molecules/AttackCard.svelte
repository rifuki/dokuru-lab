<script lang="ts">
	import type { Component } from 'svelte';
	import StatusPill from '$lib/components/atoms/StatusPill.svelte';

	type Tag = 'key' | 'star' | 'advanced' | 'proof';

	type Props = {
		icon: Component;
		index: string;
		title: string;
		description?: string;
		rule?: string;
		tag?: Tag;
		status?: 'idle' | 'running' | 'ok' | 'error';
		statusText?: string;
		accent?: 'blue' | 'commerce' | 'muted';
		children: import('svelte').Snippet;
	};

	let {
		icon: Icon,
		index,
		title,
		description,
		rule,
		tag,
		status = 'idle',
		statusText,
		accent = 'blue',
		children
	}: Props = $props();

	const accentClasses = {
		blue: 'border-black/5 bg-white',
		commerce: 'border-commerce/25 bg-white',
		muted: 'border-black/5 bg-white'
	} as const;

	const iconAccent = {
		blue: 'bg-playstation-blue/10 text-playstation-blue',
		commerce: 'bg-commerce/10 text-commerce',
		muted: 'bg-slate-100 text-body-gray'
	} as const;

	const tagStyles: Record<Tag, string> = {
		key: 'bg-commerce text-white',
		star: 'bg-commerce text-white',
		advanced: 'bg-slate-100 text-body-gray',
		proof: 'bg-slate-100 text-body-gray'
	};

	const tagLabels: Record<Tag, string> = {
		key: 'key',
		star: 'star',
		advanced: 'advanced',
		proof: 'proof'
	};
</script>

<article class={`group rounded-lg border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.07)] ${accentClasses[accent]}`}>
	<header class="mb-3 flex items-start gap-2.5">
		<span class={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${iconAccent[accent]}`} aria-hidden="true">
			<Icon size={14} strokeWidth={2.2} />
		</span>
		<div class="min-w-0 flex-1">
			<div class="flex min-w-0 items-center gap-2">
				<span class="font-mono text-[10px] tracking-[0.04em] text-body-gray">{index}</span>
				<h3 class="m-0 truncate text-[14px] font-semibold leading-tight text-ink">{title}</h3>
				{#if rule}
					<span class="ml-auto shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[9.5px] tracking-[0.04em] text-playstation-blue">
						{rule}
					</span>
				{/if}
			</div>
			{#if tag}
				<span class={`mt-2 inline-flex rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] ${tagStyles[tag]}`}>
					{tagLabels[tag]}
				</span>
			{/if}
		</div>
	</header>

	{#if description}
		<p class="m-0 mb-3 text-[12.5px] leading-[1.42] text-body-gray">{description}</p>
	{/if}

	<div class="flex flex-wrap items-center gap-2">
		{@render children()}
	</div>

	{#if status !== 'idle' || statusText}
		<div class="mt-3 flex items-center gap-2 border-t border-black/5 pt-2.5">
			<StatusPill {status} text={statusText} />
			<span class="ml-auto font-mono text-[10px] text-body-gray/70">view in terminal -></span>
		</div>
	{/if}
</article>

<style>
	:global(.status-pill-light) {
		color: var(--color-body-gray);
	}
</style>
