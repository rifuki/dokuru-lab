<script lang="ts">
	import { tick } from 'svelte';
	import type { TerminalLine } from '$lib/components/organisms/TerminalPanel.svelte';

	type Props = {
		lines: TerminalLine[];
		connected: boolean;
		busy: boolean;
		open: boolean;
		onClear: () => void;
		onClose: () => void;
	};

	let { lines, connected, busy, open, onClear, onClose }: Props = $props();
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

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden"
		aria-label="Close terminal overlay"
		onclick={onClose}
	></button>
{/if}

<aside
	class={`fixed top-0 right-0 z-40 flex h-screen w-full flex-col bg-black text-white shadow-[-12px_0_30px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out lg:w-[460px] ${
		open ? 'translate-x-0' : 'translate-x-full'
	}`}
	aria-hidden={!open}
	aria-label="Live terminal drawer"
>
	<header class="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
		<div class="flex items-center gap-3">
			<span class={`inline-block h-2 w-2 rounded-full ${statusDot}`} aria-hidden="true"></span>
			<div>
				<p class="m-0 text-[11px] font-bold tracking-[0.18em] text-white/60 uppercase">Live terminal</p>
				<p class="m-0 font-mono text-[12px] text-white/80">stdout / stderr &middot; {statusLabel}</p>
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

	<footer class="border-t border-white/10 px-5 py-3 text-[11px] text-white/50">
		Auto-scrolls to latest output. Drawer stays pinned while you trigger scenarios from the left.
	</footer>
</aside>
