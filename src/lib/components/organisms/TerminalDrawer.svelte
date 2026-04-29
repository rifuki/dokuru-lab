<script lang="ts">
	import { tick } from 'svelte';
	import type { TerminalLine } from '$lib/components/organisms/TerminalPanel.svelte';

	type Props = {
		lines: TerminalLine[];
		connected: boolean;
		busy: boolean;
		onClear: () => void;
		onClose: () => void;
	};

	let { lines, connected, busy, onClear, onClose }: Props = $props();
	let viewport = $state<HTMLDivElement | null>(null);

	$effect(() => {
		lines.length;
		void tick().then(() => {
			if (viewport) viewport.scrollTop = viewport.scrollHeight;
		});
	});

	function streamClass(stream: TerminalLine['stream']): string {
		if (stream === 'stderr') return 'text-[#ff8278]';
		if (stream === 'system') return 'text-[#9ad7ff]';
		return 'text-white';
	}

	const statusLabel = $derived(
		connected ? (busy ? 'streaming' : 'ready') : 'disconnected'
	);
	const statusDot = $derived(
		connected ? (busy ? 'bg-playstation-cyan animate-pulse' : 'bg-emerald-400') : 'bg-commerce'
	);
</script>

<header class="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
	<div class="flex items-center gap-3">
		<span class={`inline-block h-2 w-2 rounded-full ${statusDot}`} aria-hidden="true"></span>
		<div>
			<p class="m-0 text-[11px] font-bold tracking-[0.18em] text-white/60 uppercase">Live terminal</p>
			<p class="m-0 font-mono text-[12px] text-white/75">stdout / stderr &middot; {statusLabel}</p>
		</div>
	</div>
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={onClear}
			class="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-white/85 transition hover:border-white/30 hover:bg-white/10"
		>
			Clear
		</button>
		<button
			type="button"
			onclick={onClose}
			aria-label="Close terminal"
			class="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/5 text-white/85 transition hover:border-white/30 hover:bg-white/10"
		>
			<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
				<path d="M3 3l10 10M13 3L3 13" />
			</svg>
		</button>
	</div>
</header>

<div
	bind:this={viewport}
	class="flex-1 overflow-auto bg-black px-5 py-4 font-mono text-[12.5px] leading-relaxed"
	role="log"
	aria-live="polite"
>
	{#if lines.length === 0}
		<div class="text-[#9ad7ff]">waiting for terminal websocket&hellip;</div>
	{/if}

	{#each lines as line}
		<div class="grid grid-cols-[64px_56px_minmax(0,1fr)] gap-3 border-b border-white/5 py-1.5 last:border-b-0">
			<span class="text-white/35">{line.at}</span>
			<span class={streamClass(line.stream)}>{line.stream}</span>
			<pre class={`m-0 whitespace-pre-wrap break-words ${streamClass(line.stream)}`}>{line.text}</pre>
		</div>
	{/each}
</div>

<footer class="border-t border-white/10 px-5 py-2.5 text-[11px] text-white/45">
	Auto-scrolls to latest output. Stays pinned while you trigger scenarios.
</footer>
