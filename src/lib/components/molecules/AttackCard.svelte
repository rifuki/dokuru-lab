<script lang="ts">
	import type { Component } from 'svelte';
	import StatusPill from '$lib/components/atoms/StatusPill.svelte';

	type Tag = 'star' | 'key' | 'advanced' | 'entry' | 'proof' | 'app';

	type Props = {
		icon: Component;
		index: string;
		title: string;
		description: string;
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
		blue: 'border-playstation-blue/20 hover:border-playstation-blue/40 bg-white',
		commerce: 'border-commerce/30 hover:border-commerce/50 bg-white',
		muted: 'border-black/8 hover:border-black/15 bg-white/70'
	} as const;

	const iconAccent = {
		blue: 'bg-playstation-blue/10 text-playstation-blue',
		commerce: 'bg-commerce/10 text-commerce',
		muted: 'bg-slate-100 text-body-gray'
	} as const;

	const tagStyles: Record<Tag, string> = {
		star: 'bg-commerce text-white',
		key: 'bg-commerce text-white',
		advanced: 'bg-slate-100 text-body-gray',
		entry: 'bg-playstation-blue text-white',
		proof: 'bg-slate-100 text-body-gray',
		app: 'bg-amber-100 text-amber-800'
	};
</script>

<article
	class={`group rounded-lg border p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] ${accentClasses[accent]}`}
>
	<header class="mb-2 flex flex-wrap items-center gap-2">
		<span class={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${iconAccent[accent]}`} aria-hidden="true">
			<Icon size={14} strokeWidth={2.2} />
		</span>
		<span class="font-mono text-[11px] tracking-[0.04em] text-body-gray">{index}</span>
		<h3 class="m-0 text-[13.5px] font-semibold text-ink">{title}</h3>
		{#if tag}
			<span class={`rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${tagStyles[tag]}`}>
				{tag === 'key' ? 'key demo' : tag === 'star' ? 'star' : tag}
			</span>
		{/if}
		{#if rule}
			<span class="ml-auto rounded-full bg-playstation-blue/5 px-2 py-0.5 font-mono text-[9.5px] tracking-[0.04em] text-playstation-blue/80">
				{rule}
			</span>
		{/if}
	</header>

	<p class="m-0 mb-3 text-[12.5px] leading-snug text-body-gray">{description}</p>

	<div class="flex flex-wrap items-center gap-2">
		{@render children()}
	</div>

	{#if status !== 'idle' || statusText}
		<div class="mt-2.5 flex items-center justify-between gap-2 border-t border-black/5 pt-2">
			<StatusPill {status} text={statusText} />
			<span class="font-mono text-[10px] text-black/40">view in terminal →</span>
		</div>
	{/if}
</article>
