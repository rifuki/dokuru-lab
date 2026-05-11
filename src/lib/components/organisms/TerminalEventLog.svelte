<script lang="ts" module>
	export type TerminalEventKind = 'http' | 'shell' | 'system';

	export type TerminalEvent =
		| {
				id: string;
				at: string;
				kind: 'http';
				method: string;
				path: string;
				body?: unknown;
				status?: number;
				duration?: number;
				response?: unknown;
				error?: string;
			}
		| {
				id: string;
				at: string;
				kind: 'shell';
				command?: string;
				lines: Array<{ stream: 'stdout' | 'stderr' | 'stdin' | 'system'; text: string }>;
				exitCode?: number | null;
				signal?: string | null;
				running: boolean;
			}
		| {
				id: string;
				at: string;
				kind: 'system';
				text: string;
				level?: 'info' | 'warn' | 'error';
			};
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import {
		ChevronDown,
		ChevronRight,
		Copy,
		Eraser,
		Globe,
		Search,
		SendHorizontal,
		Terminal as TerminalIcon,
		X
	} from '@lucide/svelte';
	import JsonView from '$lib/components/atoms/JsonView.svelte';

	type Props = {
		events: TerminalEvent[];
		connected: boolean;
		running: boolean;
		onClear: () => void;
		onClose?: () => void;
		onSend: (command: string) => void;
		hostname: string;
	};

	let { events, connected, running, onClear, onClose, onSend, hostname }: Props = $props();

	let input = $state('');
	let filter = $state('');
	let showSearch = $state(false);
	let expanded = $state<Record<string, boolean>>({});
	let viewport = $state<HTMLDivElement | null>(null);
	let autoScroll = $state(true);
	let copied = $state('');

	$effect(() => {
		events.length;
		if (!autoScroll) return;
		void tick().then(() => {
			if (viewport) viewport.scrollTop = viewport.scrollHeight;
		});
	});

	const filteredEvents = $derived(
		filter.trim()
			? events.filter((event) => {
					const needle = filter.toLowerCase();
					if (event.kind === 'http') return `${event.method} ${event.path}`.toLowerCase().includes(needle);
					if (event.kind === 'shell') return `${event.command || ''} ${event.lines.map((line) => line.text).join('')}`.toLowerCase().includes(needle);
					return event.text.toLowerCase().includes(needle);
				})
			: events
	);

	function onScroll() {
		if (!viewport) return;
		autoScroll = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 24;
	}

	function toggle(id: string) {
		expanded = { ...expanded, [id]: !(expanded[id] ?? false) };
	}

	function isExpanded(id: string, kind: TerminalEventKind): boolean {
		if (id in expanded) return expanded[id];
		return kind === 'http' || kind === 'shell';
	}

	function submit() {
		const value = input.trim();
		if (!value) return;
		onSend(value);
		input = '';
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	}

	async function copyText(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = id;
			setTimeout(() => {
				if (copied === id) copied = '';
			}, 1200);
		} catch {
			/* clipboard blocked */
		}
	}

	function asCurl(event: TerminalEvent): string {
		if (event.kind !== 'http') return '';
		const origin = hostname ? `${window.location.protocol}//${hostname}` : window.location.origin;
		const parts = [`curl -sS -X ${event.method}`];
		if (event.body !== undefined) {
			parts.push(`-H 'content-type: application/json'`);
			parts.push(`-d '${JSON.stringify(event.body).replaceAll("'", "'\\''")}'`);
		}
		parts.push(`'${origin}${event.path}'`);
		const separator = [' \\', '  '].join('\n');
		return parts.join(separator);
	}

	function copyPayload(event: TerminalEvent): string {
		if (event.kind === 'http') return JSON.stringify(event.response ?? { ok: false, error: event.error }, null, 2);
		if (event.kind === 'shell') return event.lines.map((line) => line.text).join('');
		return event.text;
	}

	function statusBadgeClass(status?: number, error?: string): string {
		if (error) return 'bg-commerce/20 text-commerce';
		if (status && status >= 200 && status < 300) return 'bg-emerald-500/15 text-emerald-400';
		if (status && status >= 400) return 'bg-commerce/20 text-commerce';
		return 'bg-white/10 text-white/60';
	}

	function streamClass(stream: 'stdout' | 'stderr' | 'stdin' | 'system'): string {
		switch (stream) {
			case 'stderr':
				return 'text-[#ff8278]';
			case 'stdin':
				return 'text-[#b8f7cf]';
			case 'system':
				return 'text-[#9ad7ff]';
			default:
				return 'text-white/80';
		}
	}

	function systemTextClass(level?: 'info' | 'warn' | 'error'): string {
		if (level === 'error') return 'text-commerce';
		if (level === 'warn') return 'text-amber-300';
		return 'text-white/60';
	}
</script>

<div class="flex h-full min-h-0 flex-col bg-[#0a0a0a] text-white">
	<header class="flex h-9 shrink-0 items-center gap-1.5 border-b border-white/5 px-3">
		<span class="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-white/55 uppercase">
			<TerminalIcon size={11} strokeWidth={2.2} />
			Terminal
		</span>
		<span class="ml-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9.5px] text-white/50 tabular-nums">
			{events.length}
		</span>
		<span
			class={`ml-2 inline-block h-1.5 w-1.5 rounded-full ${connected ? (running ? 'bg-playstation-cyan animate-pulse' : 'bg-emerald-400') : 'bg-commerce'}`}
			aria-hidden="true"
		></span>

		<div class="ml-auto flex items-center gap-0.5">
			<button
				type="button"
				aria-label="Toggle search"
				title="Search"
				onclick={() => {
					showSearch = !showSearch;
					if (!showSearch) filter = '';
				}}
				class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/40 transition hover:bg-white/10 hover:text-white"
			>
				<Search size={11} strokeWidth={2} />
			</button>
			<button
				type="button"
				aria-label="Clear"
				title="Clear events"
				onclick={onClear}
				disabled={events.length === 0}
				class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/40 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
			>
				<Eraser size={11} strokeWidth={2} />
			</button>
			{#if onClose}
				<button
					type="button"
					aria-label="Close"
					title="Close panel"
					onclick={onClose}
					class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/40 transition hover:bg-white/10 hover:text-white"
				>
					<X size={11} strokeWidth={2} />
				</button>
			{/if}
		</div>
	</header>

	{#if showSearch}
		<div class="shrink-0 border-b border-white/5 bg-white/[0.02] px-3 py-2">
			<input
				type="text"
				placeholder="filter events..."
				value={filter}
				oninput={(event) => (filter = event.currentTarget.value)}
				class="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-white placeholder:text-white/30 focus:ring-1 focus:ring-playstation-cyan/50 focus:outline-none"
			/>
		</div>
	{/if}

	<div
		bind:this={viewport}
		onscroll={onScroll}
		class="flex-1 overflow-y-auto px-2 py-2"
		role="log"
		aria-live="polite"
	>
		{#if filteredEvents.length === 0}
			<div class="mt-8 text-center font-mono text-[11px] text-white/30">
				{filter ? 'no matching events' : 'waiting for first action...'}
			</div>
		{/if}

		{#each filteredEvents as event (event.id)}
			{@const open = isExpanded(event.id, event.kind)}
			<div class="mb-1 rounded-md border border-white/[0.04] bg-white/[0.015] text-white/80 transition-colors hover:border-white/10">
				<button
					type="button"
					onclick={() => toggle(event.id)}
					class="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left"
				>
					<span class="shrink-0 text-white/40">
						{#if open}<ChevronDown size={11} strokeWidth={2} />{:else}<ChevronRight size={11} strokeWidth={2} />{/if}
					</span>
					<span class="shrink-0 font-mono text-[10px] text-white/40 tabular-nums">{event.at}</span>

					{#if event.kind === 'http'}
						<span class="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-playstation-cyan">
							<Globe size={10} strokeWidth={2} />
							<span>{event.method}</span>
						</span>
						<span class="truncate font-mono text-[11px] text-white/85">{event.path}</span>
						{#if event.status || event.error}
							<span class={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9.5px] tabular-nums ${statusBadgeClass(event.status, event.error)}`}>
								{event.error ? 'ERR' : event.status}
							</span>
						{/if}
						{#if event.duration !== undefined}
							<span class="shrink-0 font-mono text-[10px] text-white/35 tabular-nums">{event.duration}ms</span>
						{/if}
					{:else if event.kind === 'shell'}
						<span class="shrink-0 font-mono text-[10px] text-emerald-400">$</span>
						<span class="truncate font-mono text-[11px] text-white/85">{event.command || '(interactive)'}</span>
						{#if event.running}
							<span class="ml-auto shrink-0 animate-pulse rounded-full bg-playstation-cyan/15 px-1.5 py-0.5 font-mono text-[9.5px] tracking-wider text-playstation-cyan uppercase">
								running
							</span>
						{:else if event.exitCode !== undefined && event.exitCode !== null}
							<span class={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9.5px] tabular-nums ${event.exitCode === 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-commerce/20 text-commerce'}`}>
								exit {event.exitCode}
							</span>
						{/if}
					{:else}
						<span class={`truncate font-mono text-[11px] ${systemTextClass(event.level)}`}>
							{event.text}
						</span>
					{/if}
				</button>

				{#if open}
					<div class="border-t border-white/5 bg-black/30 px-3 py-2">
						{#if event.kind === 'http'}
							{#if event.body !== undefined}
								<div class="mb-2">
									<span class="mb-1 block font-mono text-[9.5px] tracking-[0.1em] text-white/40 uppercase">Request body</span>
									<JsonView value={event.body} maxHeight="max-h-40" />
								</div>
							{/if}
							{#if event.error}
								<div class="rounded-md border border-commerce/30 bg-commerce/10 p-2 font-mono text-[11px] text-commerce">
									{event.error}
								</div>
							{:else}
								<div class="mb-2">
									<div class="mb-1 flex items-center justify-between">
										<span class="font-mono text-[9.5px] tracking-[0.1em] text-white/40 uppercase">Response</span>
										<div class="flex items-center gap-1">
											<button
												type="button"
												onclick={() => copyText(event.id + '-json', copyPayload(event))}
											style="font-size: 9px; line-height: 1;"
											class="inline-flex h-5 items-center gap-1 rounded-[5px] border border-white/10 bg-white/[0.025] px-1.5 font-mono font-medium tracking-[0.08em] text-white/45 uppercase transition hover:border-white/25 hover:bg-white/[0.055] hover:text-white"
												title="Copy JSON"
											>
												<Copy size={8} strokeWidth={2} />
												{copied === event.id + '-json' ? 'ok' : 'json'}
											</button>
											<button
												type="button"
												onclick={() => copyText(event.id + '-curl', asCurl(event))}
											style="font-size: 9px; line-height: 1;"
											class="inline-flex h-5 items-center gap-1 rounded-[5px] border border-white/10 bg-white/[0.025] px-1.5 font-mono font-medium tracking-[0.08em] text-white/45 uppercase transition hover:border-white/25 hover:bg-white/[0.055] hover:text-white"
												title="Copy as curl"
											>
												<Copy size={8} strokeWidth={2} />
												{copied === event.id + '-curl' ? 'ok' : 'curl'}
											</button>
										</div>
									</div>
									<JsonView value={event.response} maxHeight="max-h-64" />
								</div>
							{/if}
						{:else if event.kind === 'shell'}
							{#if event.command}
								<div class="mb-2 rounded-md border border-white/10 bg-black/50 px-2.5 py-1.5 font-mono text-[11px] text-emerald-400">
									$ {event.command}
								</div>
							{/if}
							<pre class="m-0 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/5 bg-black/40 px-2.5 py-2 font-mono text-[11px] leading-[1.55]">{#each event.lines as line}<span class={streamClass(line.stream)}>{line.text}</span>{/each}</pre>
						{:else}
							<p class="m-0 font-mono text-[11px] text-white/60">{event.text}</p>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<footer class="flex h-11 shrink-0 items-center gap-2 border-t border-white/5 bg-[#050505] px-3">
		<span class="font-mono text-[11px] text-emerald-400">$</span>
		<input
			type="text"
			placeholder={connected ? 'type shell command - Enter to run' : 'reconnecting...'}
			value={input}
			oninput={(event) => (input = event.currentTarget.value)}
			onkeydown={onKeyDown}
			disabled={!connected}
			class="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-white placeholder:text-white/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		/>
		<button
			type="button"
			onclick={submit}
			disabled={!connected || !input.trim()}
			aria-label="Run"
			class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/50 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
		>
			<SendHorizontal size={12} strokeWidth={2} />
		</button>
	</footer>
</div>
