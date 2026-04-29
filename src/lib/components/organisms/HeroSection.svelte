<script lang="ts">
	import {
		Activity,
		ArrowRight,
		Bomb,
		Play,
		Radio,
		ShoppingCart,
		Terminal as TerminalIcon
	} from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';

	type Props = {
		monitorConnected: boolean;
		terminalConnected: boolean;
		customerConnected: boolean;
		onProbe: () => void | Promise<void>;
		onRunCommand: () => void | Promise<void>;
		running: string;
	};

	let {
		monitorConnected,
		terminalConnected,
		customerConnected,
		onProbe,
		onRunCommand,
		running
	}: Props = $props();

	function dot(state: boolean): string {
		return state ? 'bg-emerald-400' : 'bg-commerce';
	}

	const setup = [
		{
			no: '01',
			role: 'Attacker',
			id: 'dokuru-lab',
			body: 'The vulnerable web app. You trigger every payload from inside this container — cryptominer, memory blast, secret theft, proxy sabotage.',
			Icon: Bomb,
			tint: 'commerce'
		},
		{
			no: '02',
			role: 'Neighbor',
			id: 'victim-checkout',
			body: 'A second container Dokuru must protect. Holds POSTGRES_PASSWORD and serves a checkout API that should keep responding through every blast.',
			Icon: ShoppingCart,
			tint: 'blue'
		},
		{
			no: '03',
			role: 'Signal',
			id: 'customer-traffic',
			body: 'An out-of-band probe that hits the neighbor on a loop. Its latency feed becomes the customer truth in Customer Live View.',
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

<section class="relative bg-black px-4 py-12 text-white sm:px-6 md:px-8 lg:py-16">
	<div class="mx-auto max-w-[1480px]">
		<!-- Live status strip -->
		<div class="animate-rise-in mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11.5px] tracking-[0.04em] text-white/65">
			<span class="inline-flex items-center gap-2">
				<span class={`inline-block h-1.5 w-1.5 rounded-full ${dot(monitorConnected)}`} aria-hidden="true"></span>
				/ws/monitor
			</span>
			<span class="inline-flex items-center gap-2">
				<span class={`inline-block h-1.5 w-1.5 rounded-full ${dot(terminalConnected)}`} aria-hidden="true"></span>
				/ws/terminal
			</span>
			<span class="inline-flex items-center gap-2">
				<span class={`inline-block h-1.5 w-1.5 rounded-full ${dot(customerConnected)}`} aria-hidden="true"></span>
				/ws/customer
			</span>
		</div>

		<!-- Headline + CTAs -->
		<div class="animate-rise-in max-w-4xl">
			<p class="mb-3 inline-flex items-center gap-2 text-[13px] font-medium text-[#1883fd]">
				<span class="inline-block h-1 w-1 rounded-full bg-[#1883fd]" aria-hidden="true"></span>
				Container isolation lab
			</p>
			<h1 class="mb-5 text-[clamp(32px,4.4vw,56px)] leading-[1.04] font-light tracking-[-0.4px]">
				Show the exploit, <span class="text-white/55">then show the boundary.</span>
			</h1>
			<p class="mb-7 max-w-3xl text-[16px] leading-relaxed text-[#dcdcdc]">
				A three-container playground that stays intentionally vulnerable. You trigger payloads from <code class="font-mono text-[14px] text-white">dokuru-lab</code>, and Dokuru changes what that container can see and how much it can consume — without rewriting the app.
			</p>
			<div class="flex flex-wrap items-center gap-2.5">
				<Button onclick={onProbe} disabled={Boolean(running)}>
					<span class="inline-flex items-center gap-2">
						<Play size={14} strokeWidth={2.4} fill="currentColor" />
						Run recovery probe
					</span>
				</Button>
				<Button variant="secondary" onclick={onRunCommand} disabled={Boolean(running)}>
					<span class="inline-flex items-center gap-2">
						<TerminalIcon size={14} strokeWidth={2.2} />
						Run selected command
					</span>
				</Button>
				<a
					href="#scenarios"
					class="group inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-[13px] font-medium text-white/70 transition hover:text-white"
				>
					or jump to scenarios
					<ArrowRight size={13} strokeWidth={2} class="transition-transform duration-200 group-hover:translate-x-0.5" />
				</a>
			</div>
		</div>

		<!-- The setup · three Docker containers -->
		<div class="mt-12 lg:mt-14">
			<div class="mb-5 flex items-end justify-between gap-4">
				<div>
					<p class="m-0 mb-1 text-[12px] font-medium text-white/50">The setup</p>
					<h2 class="m-0 text-[20px] leading-tight font-light tracking-tight text-white">
						Three Docker containers, one shared kernel
					</h2>
				</div>
				<span class="hidden font-mono text-[10.5px] tracking-[0.06em] text-white/35 sm:inline">
					attacker → neighbor → signal
				</span>
			</div>

			<div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-3">
				{#each setup as { no, role, id, body, Icon, tint } (no)}
					{@const t = tintToken(tint)}
					<article
						class={`group relative overflow-hidden rounded-[19px] border border-white/[0.08] bg-white/[0.025] p-5 ring-1 ring-transparent transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04] hover:shadow-[0_5px_9px_rgba(0,0,0,0.16)] ${t.ring}`}
					>
						<div class="mb-4 flex items-start justify-between gap-3">
							<span class={`grid h-9 w-9 place-items-center rounded-[10px] transition-colors ${t.swatch}`} aria-hidden="true">
								<Icon size={17} strokeWidth={2} />
							</span>
							<span class={`font-mono text-[11px] tracking-[0.08em] ${t.ink}`}>{no}</span>
						</div>

						<p class={`m-0 mb-1 text-[14.5px] font-medium ${t.ink}`}>{role}</p>
						<p class="m-0 mb-3 font-mono text-[13px] text-white">{id}</p>
						<p class="m-0 text-[13px] leading-[1.55] text-white/70">{body}</p>
					</article>
				{/each}
			</div>

			<!-- Faint flow line · decorative -->
			<div class="mt-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.04em] text-white/40 @xl/main:hidden">
				<Activity size={12} strokeWidth={2} />
				<span>signal measures blast radius after every payload</span>
			</div>
		</div>
	</div>
</section>
