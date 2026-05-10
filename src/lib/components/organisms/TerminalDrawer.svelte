<script lang="ts">
	import { onMount } from 'svelte';
	import { Eraser, Terminal as TerminalIcon, X } from '@lucide/svelte';
	import '@xterm/xterm/css/xterm.css';
	import type { FitAddon } from '@xterm/addon-fit';
	import type { Terminal as XTerm } from '@xterm/xterm';
	import type { TerminalLine } from '$lib/components/organisms/TerminalPanel.svelte';

	type Props = {
		lines: TerminalLine[];
		connected: boolean;
		hideHeader?: boolean;
		onClear: () => void;
		onClose: () => void;
		onData: (data: string) => void;
	};

	let { lines, connected, hideHeader = false, onClear, onClose, onData }: Props = $props();
	let host = $state<HTMLDivElement | null>(null);
	let terminalVersion = $state(0);
	let terminal: XTerm | null = null;
	let fitAddon: FitAddon | null = null;
	let renderedLineCount = 0;

	const statusLabel = $derived(connected ? 'interactive' : 'reconnecting');
	const totalCount = $derived(lines.length);

	onMount(() => {
		let disposed = false;
		let resizeObserver: ResizeObserver | null = null;
		let dataDisposable: { dispose: () => void } | null = null;

		void (async () => {
			const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]);
			if (disposed || !host) return;

			const term = new Terminal({
				allowProposedApi: false,
				convertEol: true,
				cursorBlink: true,
				cursorStyle: 'bar',
				fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
				fontSize: 12,
				lineHeight: 1.45,
				scrollback: 4000,
				theme: {
					background: '#050505',
					foreground: '#d8d8d8',
					cursor: '#9ad7ff',
					selectionBackground: '#1f5f8f66',
					black: '#050505',
					red: '#ff8278',
					green: '#b8f7cf',
					yellow: '#ffd479',
					blue: '#9ad7ff',
					magenta: '#c9a7ff',
					cyan: '#70e2ff',
					white: '#f2f2f2'
				}
			});

			const fit = new FitAddon();
			term.loadAddon(fit);
			term.open(host);
			terminal = term;
			fitAddon = fit;
			terminalVersion += 1;

			dataDisposable = term.onData((data) => {
				if (connected) onData(data);
			});

			resizeObserver = new ResizeObserver(() => fitTerminal());
			resizeObserver.observe(host);
			window.setTimeout(fitTerminal, 0);
		})();

		return () => {
			disposed = true;
			dataDisposable?.dispose();
			resizeObserver?.disconnect();
			terminal?.dispose();
			terminal = null;
			fitAddon = null;
		};
	});

	$effect(() => {
		terminalVersion;
		lines.length;
		if (!terminal) return;

		if (lines.length < renderedLineCount) {
			terminal.clear();
			renderedLineCount = 0;
		}

		for (let index = renderedLineCount; index < lines.length; index += 1) {
			writeTerminalLine(lines[index]);
		}
		renderedLineCount = lines.length;
	});

	function fitTerminal() {
		try {
			fitAddon?.fit();
		} catch {
			/* xterm cannot fit while hidden */
		}
	}

	function writeTerminalLine(line: TerminalLine) {
		if (!terminal) return;

		if (line.stream === 'stderr') {
			terminal.write(`\x1b[38;2;255;130;120m${line.text}\x1b[0m`);
			return;
		}

		if (line.stream === 'system') {
			terminal.write(`\x1b[38;2;154;215;255m${line.text}\x1b[0m`);
			return;
		}

		terminal.write(line.text);
	}

	function clearTerminal() {
		terminal?.clear();
		renderedLineCount = 0;
		onClear();
	}
</script>

{#snippet utilityStrip(compact: boolean)}
	<div class="flex min-h-[32px] items-center border-b border-white/5 bg-[#0a0a0a] px-4 py-1.5">
		{#if compact}
			<span class="font-mono text-[10px] font-medium tracking-[0.08em] text-white/40 uppercase">Terminal</span>
		{/if}
		<div class="ml-auto flex items-center gap-3">
			{#if compact}
				<div class="ml-1 flex items-center gap-1 border-l border-white/10 pl-3">
					<button
						type="button"
						onclick={clearTerminal}
						disabled={totalCount === 0}
						aria-label="Clear terminal"
						title="Clear terminal"
						class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/35 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
					>
						<Eraser size={12} strokeWidth={1.7} />
					</button>
					<button
						type="button"
						onclick={onClose}
						aria-label="Close"
						title="Close panel"
						class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/35 transition hover:bg-white/10 hover:text-white"
					>
						<X size={12} strokeWidth={1.7} />
					</button>
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{#if !hideHeader}
	<header class="flex items-center justify-between gap-3 border-b border-white/5 px-5 pt-5 pb-4">
		<div class="flex min-w-0 items-center gap-3">
			<span class="truncate font-mono text-[13px] tracking-[0.1em] text-white uppercase">Terminal</span>
			<span class="font-mono text-[11px] tracking-[0.05em] text-white/40 uppercase">{statusLabel}</span>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<button
				type="button"
				onclick={clearTerminal}
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
	{@render utilityStrip(true)}
{/if}

<div class="relative flex-1 overflow-hidden bg-[#050505]">
	<div bind:this={host} class="terminal-host h-full w-full px-3 py-2" aria-label="Interactive terminal"></div>
	{#if !connected}
		<div class="pointer-events-none absolute inset-0 grid place-items-center bg-black/35 text-center backdrop-blur-[1px]">
			<div class="rounded-lg border border-white/10 bg-black/75 px-4 py-3 shadow-lg">
				<TerminalIcon size={22} strokeWidth={1.4} class="mx-auto mb-2 text-white/35" />
				<p class="m-0 font-mono text-[11px] tracking-[0.04em] text-white/50 uppercase">reconnecting terminal</p>
			</div>
		</div>
	{/if}
</div>

<footer class="flex items-center justify-end border-t border-white/5 px-4 py-1.5">
	<span class="font-mono text-[9.5px] tracking-[0.14em] text-white/18">drag edge to resize</span>
</footer>

<style>
	.terminal-host :global(.xterm) {
		height: 100%;
	}

	.terminal-host :global(.xterm-viewport) {
		background-color: transparent !important;
		scrollbar-color: rgba(255, 255, 255, 0.24) transparent;
	}

	.terminal-host :global(.xterm-screen) {
		width: 100%;
	}
</style>
