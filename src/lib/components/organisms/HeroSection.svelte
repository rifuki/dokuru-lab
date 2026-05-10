<script lang="ts">
	import {
		Activity,
		ArrowRight,
		Bomb,
		Play,
		Radio,
		ShoppingCart,
		Terminal as TerminalIcon,
		Waves
	} from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';

	type Props = {
		monitorConnected: boolean;
		terminalConnected: boolean;
		customerConnected: boolean;
		theme: 'dark' | 'light';
		onProbe: () => void | Promise<void>;
		running: string;
	};

	let {
		monitorConnected,
		terminalConnected,
		customerConnected,
		theme,
		onProbe,
		running
	}: Props = $props();
	const dark = $derived(theme === 'dark');

	function dot(state: boolean): string {
		return state ? 'bg-emerald-400' : 'bg-commerce';
	}

	const setup = [
		{
			no: '01',
			role: 'Attacker',
			id: 'dokuru-lab',
			body: 'A vulnerable default-root web app with bind mounts. Upload and command-injection bugs become host-root evidence when userns-remap is off.',
			Icon: Bomb,
			tint: 'commerce'
		},
		{
			no: '02',
			role: 'Neighbor',
			id: 'victim-checkout',
			body: 'A customer-facing API that should stay responsive while the baseline app tries to consume unconstrained CPU, memory, and PIDs.',
			Icon: ShoppingCart,
			tint: 'blue'
		},
		{
			no: '03',
			role: 'Signal',
			id: 'customer-traffic',
			body: 'An out-of-band probe that hits checkout on a loop. Its latency feed is the visible blast-radius signal for the cgroup demo.',
			Icon: Radio,
			tint: 'cyan'
		}
	] as const;

	function tintToken(t: 'commerce' | 'blue' | 'cyan'): { swatch: string; ink: string; ring: string } {
		switch (t) {
			case 'commerce':
				return {
					swatch: 'bg-[#d53b00]/15 text-[#ff7a47]',
					ink: 'text-[#ff7a47]',
					ring: 'group-hover:ring-[#d53b00]/35'
				};
			case 'blue':
				return {
					swatch: 'bg-[#0070cc]/18 text-[#7fc4ff]',
					ink: 'text-[#7fc4ff]',
					ring: 'group-hover:ring-[#0070cc]/35'
				};
			case 'cyan':
				return {
					swatch: 'bg-[#1eaedb]/18 text-[#9ad7ff]',
					ink: 'text-[#9ad7ff]',
					ring: 'group-hover:ring-[#1eaedb]/35'
				};
		}
	}
</script>

<section
	class={`relative flex min-h-[calc(100vh-48px)] flex-col justify-center px-4 py-8 sm:px-6 md:px-8 lg:py-10 ${
		dark ? 'bg-black text-white' : 'bg-white text-black'
	}`}
>
	<div class="mx-auto w-full max-w-[1480px]">
	<!-- Live status strip -->
		<div class={`animate-rise-in mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11.5px] tracking-[0.04em] ${dark ? 'text-white/65' : 'text-black/55'}`}>
			<span class={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${dark ? 'border-white/8 bg-white/[0.03]' : 'border-black/8 bg-black/[0.025]'}`}>
				<Waves size={11} strokeWidth={2.2} class={dark ? 'text-white/45' : 'text-black/35'} />
				<span class={`inline-block h-1.5 w-1.5 rounded-full ${dot(monitorConnected)}`} aria-hidden="true"></span>
				<span>/ws/monitor</span>
			</span>
			<span class={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${dark ? 'border-white/8 bg-white/[0.03]' : 'border-black/8 bg-black/[0.025]'}`}>
				<TerminalIcon size={11} strokeWidth={2.2} class={dark ? 'text-white/45' : 'text-black/35'} />
				<span class={`inline-block h-1.5 w-1.5 rounded-full ${dot(terminalConnected)}`} aria-hidden="true"></span>
				<span>/ws/terminal</span>
			</span>
			<span class={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${dark ? 'border-white/8 bg-white/[0.03]' : 'border-black/8 bg-black/[0.025]'}`}>
				<Radio size={11} strokeWidth={2.2} class={dark ? 'text-white/45' : 'text-black/35'} />
				<span class={`inline-block h-1.5 w-1.5 rounded-full ${dot(customerConnected)}`} aria-hidden="true"></span>
				<span>/ws/customer</span>
			</span>
		</div>

		<!-- Headline + CTAs -->
		<div class="animate-rise-in max-w-4xl">
			<h1 class="mb-3 text-[clamp(32px,4.4vw,56px)] leading-[1.04] font-light tracking-[-0.4px]">
				Default Docker, <span class={dark ? 'text-white/55' : 'text-black/42'}>root-owned artifacts on the host.</span>
			</h1>
			<p class={`mb-5 max-w-2xl text-[15px] leading-relaxed ${dark ? 'text-[#dcdcdc]' : 'text-black/62'}`}>
				Trigger payloads from <code class={`font-mono text-[14px] ${dark ? 'text-white' : 'text-black'}`}>dokuru-lab</code>, then watch the neighbor service and container evidence update live.
			</p>
			<div class="flex flex-wrap items-center gap-4">
				<Button onclick={onProbe} disabled={Boolean(running)}>
					<span class="inline-flex items-center gap-2">
						<Play size={16} strokeWidth={1.5} fill="currentColor" />
						Check container health
					</span>
				</Button>
				<a
					href="/exploit"
					class={`group inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] tracking-wide font-medium transition-all ${dark ? 'text-white/60 hover:text-white' : 'text-black/55 hover:text-playstation-blue'}`}
				>
					open control deck
					<ArrowRight size={14} strokeWidth={1.5} class="transition-transform duration-300 ease-out group-hover:translate-x-1" />
				</a>
			</div>
		</div>

		<!-- The setup · three Docker containers -->
		<div class="mt-8 lg:mt-10">
			<div class="mb-4 flex items-end justify-between gap-4">
				<div>
					<p class={`m-0 mb-1 text-[12px] font-medium ${dark ? 'text-white/50' : 'text-black/45'}`}>The setup</p>
					<h2 class="m-0 text-[20px] leading-tight font-light tracking-tight">
						Three Docker containers, one shared kernel
					</h2>
				</div>
				<span class={`hidden font-mono text-[10.5px] tracking-[0.06em] sm:inline ${dark ? 'text-white/35' : 'text-black/35'}`}>
					attacker → neighbor → signal
				</span>
			</div>

			<div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-3">
				{#each setup as { no, role, id, body, Icon, tint } (no)}
					{@const t = tintToken(tint)}
					<article
						class={`group relative overflow-hidden rounded-[19px] border p-5 ring-1 ring-transparent transition-all duration-300 ease-out hover:-translate-y-1 ${
							dark
								? `border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${t.ring}`
								: 'border-black/6 bg-white hover:border-playstation-blue/20 hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]'
						}`}
					>
						<div class="mb-4 flex items-start justify-between gap-3">
							<span class={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${t.swatch}`} aria-hidden="true">
								<Icon size={20} strokeWidth={1.25} />
							</span>
							<span class={`font-mono text-[12px] tracking-[0.1em] ${t.ink}`}>{no}</span>
						</div>

						<p class={`m-0 mb-1.5 text-[15px] font-medium tracking-wide ${t.ink}`}>{role}</p>
						<p class={`m-0 mb-3 font-mono text-[13px] ${dark ? 'text-white opacity-90' : 'text-black/80'}`}>{id}</p>
						<p class={`m-0 text-[13.5px] leading-[1.6] transition-colors ${dark ? 'text-white/60 group-hover:text-white/80' : 'text-black/58 group-hover:text-black/75'}`}>{body}</p>
					</article>
				{/each}
			</div>

			<!-- Faint flow line · decorative -->
			<div class={`mt-4 flex items-center gap-3 font-mono text-[11px] tracking-[0.04em] @xl/main:hidden ${dark ? 'text-white/40' : 'text-black/40'}`}>
				<Activity size={12} strokeWidth={2} />
				<span>signal measures blast radius after every payload</span>
			</div>
		</div>
	</div>
</section>
