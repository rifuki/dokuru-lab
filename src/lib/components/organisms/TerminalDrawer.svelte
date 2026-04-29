<script lang="ts">
	import { tick } from 'svelte';
	import { ArrowDown, ChevronRight, Eraser, X } from '@lucide/svelte';
	import type { TerminalLine } from '$lib/components/organisms/TerminalPanel.svelte';

	type StreamKey = 'stdout' | 'stderr' | 'system';

	type Props = {
		lines: TerminalLine[];
		connected: boolean;
		busy: boolean;
		onClear: () => void;
		onClose: () => void;
	};

	let { lines, connected, busy, onClear, onClose }: Props = $props();
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

	const statusLabel = $derived(connected ? (busy ? 'streaming' : 'ready') : 'offline');
	const statusDot = $derived(
		connected ? (busy ? 'bg-playstation-cyan animate-pulse' : 'bg-emerald-400') : 'bg-commerce'
	);
	const filteredCount = $derived(visibleLines.length);
	const totalCount = $derived(lines.length);

	const streamMeta: { key: StreamKey; label: string }[] = [
		{ key: 'stdout', label: 'out' },
		{ key: 'stderr', label: 'err' },
		{ key: 'system', label: 'sys' }
	];
</script>

<header class="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
	<div class="flex min-w-0 items-center gap-2.5">
		<span class={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} aria-hidden="true"></span>
		<span class="truncate font-mono text-[12px] text-white/85">terminal</span>
		<span class="font-mono text-[10.5px] text-white/35">·</span>
		<span class="font-mono text-[10.5px] text-white/55">{statusLabel}</span>
	</div>
	<div class="flex shrink-0 items-center gap-1">
		<button
			type="button"
			onclick={onClear}
			disabled={totalCount === 0}
			aria-label="Clear terminal"
			title="Clear"
			class="grid h-7 w-7 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
		>
			<Eraser size={13} strokeWidth={2} />
		</button>
		<button
			type="button"
			onclick={onClose}
			aria-label="Close terminal"
			title="Close"
			class="grid h-7 w-7 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"
		>
			<X size={14} strokeWidth={2} />
		</button>
	</div>
</header>

<div class="flex items-center gap-1.5 px-4 pb-3">
	{#each streamMeta as { key, label } (key)}
		{@const active = activeStreams[key]}
		<button
			type="button"
			onclick={() => toggleStream(key)}
			aria-pressed={active}
			class="h-6 rounded-md border px-2 font-mono text-[10.5px] tracking-[0.04em] transition {active
				? key === 'stderr'
					? 'border-[#ff827833] bg-[#ff82781f] text-[#ffb1aa] hover:bg-[#ff82782e]'
					: key === 'system'
					? 'border-[#9ad7ff33] bg-[#9ad7ff1f] text-[#bce4ff] hover:bg-[#9ad7ff2e]'
					: 'border-white/15 bg-white/8 text-white/85 hover:bg-white/15'
				: 'border-white/8 bg-transparent text-white/30 hover:border-white/15 hover:text-white/55'}"
		>
			{label}
		</button>
	{/each}
	<span class="ml-auto font-mono text-[10.5px] text-white/40">
		{filteredCount}{filteredCount !== totalCount ? `/${totalCount}` : ''} lines
	</span>
</div>

<div
	bind:this={viewport}
	onscroll={onScroll}
	class="relative flex-1 overflow-auto bg-black font-mono text-[12px] leading-[1.55]"
	role="log"
	aria-live="polite"
>
	{#if totalCount === 0}
		<div class="px-4 pt-2 pb-4 text-white/40">
			<p class="m-0 flex items-center gap-1.5 text-[12px] text-white/55">
				<ChevronRight size={12} strokeWidth={2.2} class="text-white/40" />
				awaiting websocket
			</p>
			<p class="m-0 mt-1 pl-[18px] text-[11.5px] text-white/30">
				trigger a scenario to stream stdout, stderr, and system events here
			</p>
			<span class="mt-3 ml-[18px] inline-block h-3 w-1.5 animate-pulse bg-white/40" aria-hidden="true"></span>
		</div>
	{:else if filteredCount === 0}
		<div class="px-4 pt-2 pb-4 text-[11.5px] text-white/35">
			<p class="m-0">no lines match the active filter</p>
		</div>
	{:else}
		<ol class="m-0 list-none p-0">
			{#each visibleLines as line, idx (idx)}
				<li class="group flex gap-3 px-4 py-[3px] transition-colors hover:bg-white/[0.04]">
					<span class="shrink-0 select-none font-mono text-[10.5px] text-white/30 tabular-nums" aria-hidden="true">
						{line.at}
					</span>
					<span class={`shrink-0 select-none text-[10.5px] tracking-[0.04em] opacity-60 ${streamColor(line.stream)}`} aria-hidden="true">
						{streamGlyph(line.stream)}
					</span>
					<pre class={`m-0 min-w-0 flex-1 whitespace-pre-wrap break-words ${streamColor(line.stream)}`}>{line.text}</pre>
				</li>
			{/each}
		</ol>
	{/if}

	{#if !stickToBottom && pendingCount > 0}
		<button
			type="button"
			onclick={jumpToLatest}
			class="sticky right-3 bottom-3 ml-auto flex items-center gap-1.5 rounded-full bg-playstation-blue px-3 py-1.5 font-mono text-[10.5px] tracking-[0.04em] text-white shadow-[0_5px_9px_rgba(0,0,0,0.25)] transition hover:bg-link-hover"
		>
			<ArrowDown size={11} strokeWidth={2.4} />
			{pendingCount > 99 ? '99+' : pendingCount} new
		</button>
	{/if}
</div>

<footer class="flex items-center justify-between border-t border-white/5 px-4 py-2 font-mono text-[10px] tracking-[0.04em] text-white/30">
	<span>{stickToBottom ? 'auto-scroll on' : 'paused'}</span>
	<span>drag edge to resize</span>
</footer>
