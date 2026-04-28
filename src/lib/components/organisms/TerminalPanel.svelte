<script lang="ts">
	import { tick } from 'svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';

	export type TerminalLine = {
		stream: 'system' | 'stdout' | 'stderr';
		text: string;
		at: string;
	};

	type Props = {
		lines: TerminalLine[];
		connected: boolean;
		busy: boolean;
		onClear: () => void;
	};

	let { lines, connected, busy, onClear }: Props = $props();
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
</script>

<Panel
	id="terminal"
	title="Live terminal"
	subtitle={connected ? (busy ? 'WebSocket streaming' : 'WebSocket ready') : 'WebSocket disconnected'}
	class="lg:col-span-12"
>
	<div class="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-center">
		<p class="m-0 max-w-3xl text-sm leading-relaxed text-body-gray">
			This is the real stdout/stderr stream from commands and resource-pressure payloads running inside the vulnerable container.
		</p>
		<Button variant="ghost" size="sm" onclick={onClear}>Clear terminal</Button>
	</div>

	<div
		bind:this={viewport}
		class="h-[390px] overflow-auto rounded-2xl border border-black bg-black p-4 font-mono text-[13px] leading-relaxed shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
		role="log"
		aria-live="polite"
	>
		{#if lines.length === 0}
			<div class="text-[#9ad7ff]">waiting for terminal websocket...</div>
		{/if}

		{#each lines as line}
			<div class="grid grid-cols-[86px_68px_minmax(0,1fr)] gap-3 border-b border-white/5 py-1.5 last:border-b-0">
				<span class="text-white/40">{line.at}</span>
				<span class={streamClass(line.stream)}>{line.stream}</span>
				<pre class={`m-0 whitespace-pre-wrap break-words ${streamClass(line.stream)}`}>{line.text}</pre>
			</div>
		{/each}
	</div>
</Panel>
