<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';

	type Props = {
		onRefresh: () => void | Promise<void>;
		onToggleTerminal: () => void;
		running: boolean;
		terminalOpen: boolean;
		terminalConnected: boolean;
		terminalBusy: boolean;
	};

	let {
		onRefresh,
		onToggleTerminal,
		running,
		terminalOpen,
		terminalConnected,
		terminalBusy
	}: Props = $props();

	const dotClass = $derived(
		terminalConnected
			? terminalBusy
				? 'bg-playstation-cyan animate-pulse'
				: 'bg-emerald-400'
			: 'bg-commerce'
	);
</script>

<nav class="sticky top-0 z-30 bg-black text-white" aria-label="Primary">
	<div class="mx-auto flex max-w-[1540px] items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8">
		<a class="inline-flex items-center gap-2.5 text-[15px] font-semibold text-white no-underline" href="/" aria-label="Dokuru Lab home">
			<span class="grid h-7 w-7 place-items-center rounded-full bg-white font-bold text-playstation-blue">D</span>
			<span>Dokuru Lab</span>
		</a>

		<div class="hidden items-center gap-5 text-[13px] font-medium @4xl/page:flex">
			<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#monitor">Monitor</a>
			<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#scenarios">Scenarios</a>
			<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#namespace">Namespace</a>
			<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#cgroup">Cgroup</a>
			<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#evidence">Evidence</a>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onToggleTerminal}
				aria-pressed={terminalOpen}
				class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12.5px] font-bold tracking-[0.06em] text-white transition hover:border-white/35 hover:bg-white/10"
			>
				<span class={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true"></span>
				<span class="hidden @xs/page:inline">Terminal</span>
				<span class="font-mono text-[11px] text-white/55">{terminalOpen ? 'hide' : 'show'}</span>
			</button>
			<Button variant="secondary" size="sm" onclick={onRefresh} disabled={running}>Refresh evidence</Button>
		</div>
	</div>
</nav>
