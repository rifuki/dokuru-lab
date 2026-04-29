<script lang="ts">
	import { tick } from 'svelte';
	import { ArrowDown, ChevronRight, Eraser, Terminal as TerminalIcon, X } from '@lucide/svelte';
	import type { TerminalLine } from '$lib/components/organisms/TerminalPanel.svelte';

	type StreamKey = 'stdout' | 'stderr' | 'system';

	type Props = {
		lines: TerminalLine[];
		connected: boolean;
		busy: boolean;
		hideHeader?: boolean;
		onClear: () => void;
		onClose: () => void;
	};

	let { lines, connected, busy, hideHeader = false, onClear, onClose }: Props = $props();
	let viewport = $state<HTMLDivElement | null>(null);
	let stickToBottom = $state(true);
	let pendingCount = $state(0);
	let activeStreams = $state<Record<StreamKey, boolean>>({
		stdout: true,
		stderr: true,
		system: true
	});

	const visibleLines = $derived(lines.filter((line) => activeStreams[line.stream]));

	$effect(() => {
		visibleLines.length;
		void tick().then(() => {
			if (!viewport) return;
			if (stickToBottom) {
				viewport.scrollTop = viewport.scrollHeight;
				pendingCount = 0;
			} else {
				pendingCount += 1;
			}
		});
	});

	function onScroll() {
		if (!viewport) return;
		const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
		const next = distance < 28;
		if (next !== stickToBottom) stickToBottom = next;
		if (next) pendingCount = 0;
	}

	function jumpToLatest() {
		if (!viewport) return;
		viewport.scrollTop = viewport.scrollHeight;
		stickToBottom = true;
		pendingCount = 0;
	}

	function toggleStream(key: StreamKey) {
		activeStreams = { ...activeStreams, [key]: !activeStreams[key] };
	}

	function streamColor(stream: TerminalLine['stream']): string {
		if (stream === 'stderr') return 'text-[#ff8278]';
		if (stream === 'system') return 'text-[#9ad7ff]';
		return 'text-white/90';
	}

	function streamGlyph(stream: TerminalLine['stream']): string {
		if (stream === 'stderr') return 'err';
		if (stream === 'system') return 'sys';
		return 'out';
	}

	const statusLabel = $derived(connected ? (busy ? 'streaming' : 'live') : 'connecting');
	const filteredCount = $derived(visibleLines.length);
	const totalCount = $derived(lines.length);

	const streamMeta: { key: StreamKey; label: string }[] = [
		{ key: 'stdout', label: 'out' },
		{ key: 'stderr', label: 'err' },
		{ key: 'system', label: 'sys' }
	];
</script>

{#if !hideHeader}
<header class="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/5">
	<div class="flex min-w-0 items-center gap-3">
		<span class="truncate font-mono text-[13px] uppercase tracking-[0.1em] text-white">Terminal</span>
		<span class="font-mono text-[11px] uppercase tracking-[0.05em] text-white/40">{statusLabel}</span>
	</div>
	<div class="flex shrink-0 items-center gap-2">
		<button
			type="button"
			onclick={onClear}
			disabled={totalCount === 0}
			aria-label="Clear terminal"
			title="Clear"
			class="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
		>
			<Eraser size={14} strokeWidth={1.5} />
		</button>
		<button
			type="button"
			onclick={onClose}
			aria-label="Close terminal"
			title="Close"
			class="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
		>
			<X size={16} strokeWidth={1.5} />
		</button>
	</div>
</header>
{:else}
<!-- Compact status strip when header is managed by parent -->
<div class="flex items-center justify-between border-b border-white/5 px-4 py-1.5 min-h-[32px]">
	<span class="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-white/40">Terminal</span>
	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			onclick={onClear}
			disabled={totalCount === 0}
			aria-label="Clear terminal"
			title="Clear terminal"
			class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/35 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
		>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
		</button>
		<button
			type="button"
			onclick={onClose}
			aria-label="Close"
			title="Close panel"
			class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/35 transition hover:bg-white/10 hover:text-white"
		>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
		</button>
	</div>
</div>
{/if}

<div class="flex items-center gap-3 border-b border-white/5 bg-[#0a0a0a] px-4 py-1.5">
	{#each streamMeta as { key, label } (key)}
		{@const active = activeStreams[key]}
		<button
			type="button"
			onclick={() => toggleStream(key)}
			aria-pressed={active}
			class="relative cursor-pointer pb-0.5 font-mono text-[10px] tracking-[0.04em] transition-colors {active
				? key === 'stderr'
					? 'text-[#ff8278]'
					: key === 'system'
					? 'text-[#9ad7ff]'
					: 'text-white'
				: 'text-white/30 hover:text-white/70'}"
		>
			{label}
			{#if active}
				<span class="absolute right-0 bottom-0 left-0 h-[1.5px] bg-current"></span>
			{/if}
		</button>
	{/each}
	<span class="ml-auto font-mono text-[10px] tracking-[0.02em] text-white/30 tabular-nums">
		{filteredCount}{filteredCount !== totalCount ? `/${totalCount}` : ''} lines
	</span>
</div>

<div
	bind:this={viewport}
	onscroll={onScroll}
	class="relative flex-1 overflow-auto bg-[#050505] font-mono text-[12px] leading-[1.6]"
	role="log"
	aria-live="polite"
>
	{#if totalCount === 0}
		<div class="flex h-full flex-col items-center justify-center p-8 text-center text-white/40">
			<TerminalIcon size={32} strokeWidth={1} class="mb-4 text-white/20" />
			<p class="m-0 text-[13px] text-white/60">Awaiting websocket connection</p>
			<p class="m-0 mt-2 max-w-xs text-[12px] text-white/30">Trigger a scenario to stream stdout, stderr, and system events here.</p>
		</div>
	{:else if filteredCount === 0}
		<div class="flex h-full items-center justify-center p-8 text-center text-[12px] text-white/30">
			<p class="m-0">No lines match the active filter</p>
		</div>
	{:else}
		<ol class="m-0 list-none p-0 py-2">
			{#each visibleLines as line, idx (idx)}
				<li class="group relative flex items-start gap-4 px-5 py-[2px] hover:bg-white/[0.03]">
					<span class="mt-0.5 shrink-0 select-none font-mono text-[10px] text-white/20 tabular-nums" aria-hidden="true">
						{line.at}
					</span>
					<!-- Colored left border indicator based on stream -->
					<div class={`absolute left-0 top-0 bottom-0 w-[2px] opacity-0 group-hover:opacity-100 transition-opacity ${
						line.stream === 'stderr' ? 'bg-[#ff8278]' : 
						line.stream === 'system' ? 'bg-[#9ad7ff]' : 'bg-white/40'
					}`}></div>
					
					<pre class={`m-0 min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.6] ${
						line.stream === 'stderr' ? 'text-[#ff8278]/90' : 
						line.stream === 'system' ? 'text-[#9ad7ff]/90' : 'text-white/80'
					}`}>{line.text}</pre>
				</li>
			{/each}
		</ol>
	{/if}

	{#if !stickToBottom && pendingCount > 0}
		<button
			type="button"
			onclick={jumpToLatest}
			class="sticky right-3 bottom-3 ml-auto flex cursor-pointer items-center gap-1.5 rounded-full bg-playstation-blue px-3 py-1.5 font-mono text-[10.5px] tracking-[0.04em] text-white shadow-[0_5px_9px_rgba(0,0,0,0.25)] transition hover:bg-link-hover"
		>
			<ArrowDown size={11} strokeWidth={2.4} />
			{pendingCount > 99 ? '99+' : pendingCount} new
		</button>
	{/if}
</div>

<footer class="flex items-center justify-between border-t border-white/5 px-4 py-2">
	<div class="flex items-center gap-2">
		<span class="font-mono text-[10px] tracking-[0.04em] {stickToBottom ? 'text-white/40' : 'text-white/20'}">auto-scroll</span>
		<button
			type="button"
			onclick={() => {
				stickToBottom = !stickToBottom;
				if (stickToBottom) jumpToLatest();
			}}
			class="relative inline-flex h-[14px] w-[26px] cursor-pointer items-center rounded-full transition-colors duration-200 {stickToBottom ? 'bg-emerald-500' : 'bg-white/15'}"
			title={stickToBottom ? 'Auto-scroll ON — click to pause' : 'Auto-scroll OFF — click to resume'}
			aria-pressed={stickToBottom}
			aria-label="Toggle auto-scroll"
		>
			<span class="absolute inline-block h-[10px] w-[10px] rounded-full bg-white shadow-sm transition-transform duration-200 {stickToBottom ? 'translate-x-[14px]' : 'translate-x-[2px]'}"></span>
		</button>
	</div>
	<span class="font-mono text-[10px] tracking-[0.04em] text-white/25">drag edge to resize</span>
</footer>
