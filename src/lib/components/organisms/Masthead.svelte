<script lang="ts">
	import { FlaskConical, Moon, Sun } from '@lucide/svelte';

	type UiTheme = 'dark' | 'light';

	type Props = {
		monitorConnected: boolean;
		monitorLastUpdated: string;
		theme: UiTheme;
		runtimeLabel: string;
		onThemeToggle: () => void;
	};

	let { monitorConnected, monitorLastUpdated, theme, runtimeLabel, onThemeToggle }: Props = $props();
	const dark = $derived(theme === 'dark');
</script>

<nav
	class={`sticky top-0 z-30 h-[54px] border-b backdrop-blur-xl ${
		dark ? 'border-white/5 bg-black/92 text-white' : 'border-black/8 bg-white/92 text-black'
	}`}
	aria-label="Primary"
>
	<div class="mx-auto flex h-full max-w-[1540px] items-center justify-between gap-6 px-4 sm:px-6 md:px-8">
		<a class="inline-flex items-center gap-2.5 text-[15px] font-semibold text-current no-underline" href="/" aria-label="Dokuru Lab home">
			<span class={`grid h-7 w-7 place-items-center rounded-full ${dark ? 'bg-white text-playstation-blue' : 'bg-playstation-blue text-white'}`} aria-hidden="true">
				<FlaskConical size={14} strokeWidth={2.2} />
			</span>
			<span>Dokuru Lab</span>
			<span class={`hidden rounded-full border px-2 py-[2px] font-mono text-[10px] tracking-[0.04em] @md/page:inline ${dark ? 'border-white/12 text-white/55' : 'border-black/10 text-black/55'}`}>{runtimeLabel}</span>
		</a>

		<div class="flex items-center gap-5 text-[13px] font-medium">
			<div class="hidden items-center gap-5 @4xl/page:flex">
				<a class={`${dark ? 'text-white/85' : 'text-black/70'} no-underline transition hover:text-[#1883fd]`} href="/monitor">Monitor</a>
				<a class={`${dark ? 'text-white/85' : 'text-black/70'} no-underline transition hover:text-[#1883fd]`} href="/namespace">Root Map</a>
				<a class={`${dark ? 'text-white/85' : 'text-black/70'} no-underline transition hover:text-[#1883fd]`} href="/exploit">Exploit</a>
				<a class={`${dark ? 'text-white/85' : 'text-black/70'} no-underline transition hover:text-[#1883fd]`} href="/cgroup">Resources</a>
				<a class={`${dark ? 'text-white/85' : 'text-black/70'} no-underline transition hover:text-[#1883fd]`} href="/evidence">Evidence</a>
			</div>
			<span class={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] @2xl/page:inline-flex ${monitorConnected ? 'text-emerald-500' : 'text-commerce'}`}>
				<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
				{monitorConnected ? monitorLastUpdated || 'live' : 'offline'}
			</span>
			<button
				type="button"
				onclick={onThemeToggle}
				class={`grid h-8 w-8 cursor-pointer place-items-center rounded-full border transition ${
					dark
						? 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'
						: 'border-black/10 bg-black/[0.03] text-black/65 hover:border-playstation-blue/35 hover:text-playstation-blue'
				}`}
				aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
				title={dark ? 'Light theme' : 'Dark theme'}
			>
				{#if dark}
					<Sun size={15} strokeWidth={1.8} />
				{:else}
					<Moon size={15} strokeWidth={1.8} />
				{/if}
			</button>
		</div>
	</div>
</nav>
