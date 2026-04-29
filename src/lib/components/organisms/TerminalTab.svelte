<script lang="ts">
	type Props = {
		connected: boolean;
		busy: boolean;
		lineCount: number;
		onOpen: () => void;
	};

	let { connected, busy, lineCount, onOpen }: Props = $props();

	const dotClass = $derived(
		connected ? (busy ? 'bg-playstation-cyan animate-pulse' : 'bg-emerald-400') : 'bg-commerce'
	);
	const statusLabel = $derived(connected ? (busy ? 'streaming' : 'ready') : 'offline');
</script>

<button
	type="button"
	onclick={onOpen}
	aria-label="Open live terminal"
	class="group fixed top-1/2 right-0 z-30 flex -translate-y-1/2 translate-x-[1px] items-center gap-2.5 rounded-l-2xl border border-r-0 border-white/10 bg-black px-3 py-5 text-white shadow-[-6px_0_18px_rgba(0,0,0,0.18)] transition hover:translate-x-0 hover:border-white/25 hover:bg-[#0a0a0a]"
>
	<span class={`inline-block h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true"></span>
	<span class="flex flex-col items-start gap-0.5 [writing-mode:vertical-rl] [text-orientation:mixed]">
		<span class="text-[11px] font-bold tracking-[0.22em] text-white uppercase">Terminal</span>
		<span class="font-mono text-[10px] tracking-[0.1em] text-white/55">{statusLabel}</span>
	</span>
	{#if lineCount > 0}
		<span class="absolute -top-1.5 -left-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-playstation-blue px-1 font-mono text-[10px] font-bold text-white">
			{lineCount > 99 ? '99+' : lineCount}
		</span>
	{/if}
</button>
