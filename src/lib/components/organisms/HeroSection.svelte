<script lang="ts">
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
</script>

<section class="bg-black px-4 py-12 text-white sm:px-6 md:px-8 lg:py-16">
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
			<p class="mb-3 text-[12px] font-bold tracking-[0.18em] text-[#1883fd] uppercase">Container isolation lab</p>
			<h1 class="mb-5 text-[clamp(32px,4.4vw,56px)] leading-[1.04] font-light tracking-[-0.4px]">
				Show the exploit, <span class="text-white/55">then show the boundary.</span>
			</h1>
			<p class="mb-7 max-w-3xl text-[16px] leading-relaxed text-[#dcdcdc]">
				A three-container playground that stays intentionally vulnerable. You trigger payloads from <code>dokuru-lab</code>, and Dokuru changes what that container can see and how much it can consume &mdash; without rewriting the app.
			</p>
			<div class="flex flex-wrap items-center gap-2.5">
				<Button onclick={onProbe} disabled={Boolean(running)}>Run recovery probe</Button>
				<Button variant="secondary" onclick={onRunCommand} disabled={Boolean(running)}>Run selected command</Button>
				<a
					href="#scenarios"
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-[13px] font-medium text-white/70 transition hover:text-white"
				>
					or jump to scenarios
					<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
						<path d="M3 8h10M9 4l4 4-4 4" />
					</svg>
				</a>
			</div>
		</div>

		<!-- The setup · architecture diagram -->
		<div class="mt-12 border-t border-white/10 pt-8 lg:mt-14 lg:pt-10">
			<p class="mb-5 text-[12px] font-bold tracking-[0.18em] text-white/55 uppercase">The setup &middot; three Docker containers</p>

			<div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-3">
				<article class="relative rounded-2xl border border-commerce/40 bg-commerce/5 p-5">
					<p class="m-0 mb-3 text-[11px] font-bold tracking-[0.2em] text-commerce uppercase">01 &middot; Attacker</p>
					<p class="m-0 mb-1.5 font-mono text-[15px] font-semibold text-white">dokuru-lab</p>
					<p class="m-0 text-[13px] leading-relaxed text-white/70">
						The vulnerable web app. You trigger every payload from inside this container &mdash; cryptominer, memory blast, secret theft, proxy sabotage.
					</p>
				</article>

				<article class="relative rounded-2xl border border-playstation-blue/35 bg-playstation-blue/10 p-5">
					<p class="m-0 mb-3 text-[11px] font-bold tracking-[0.2em] text-[#7fc4ff] uppercase">02 &middot; Neighbor</p>
					<p class="m-0 mb-1.5 font-mono text-[15px] font-semibold text-white">victim-checkout</p>
					<p class="m-0 text-[13px] leading-relaxed text-white/70">
						A second container Dokuru must protect. Holds <code>POSTGRES_PASSWORD</code> and serves a checkout API that should keep responding through every blast.
					</p>
				</article>

				<article class="relative rounded-2xl border border-playstation-cyan/35 bg-playstation-cyan/10 p-5">
					<p class="m-0 mb-3 text-[11px] font-bold tracking-[0.2em] text-[#9ad7ff] uppercase">03 &middot; Signal</p>
					<p class="m-0 mb-1.5 font-mono text-[15px] font-semibold text-white">customer-traffic</p>
					<p class="m-0 text-[13px] leading-relaxed text-white/70">
						An out-of-band probe that hits the neighbor on a loop. Its latency feed is the customer truth in <strong class="text-white">Customer Live View</strong>.
					</p>
				</article>
			</div>

			<p class="mt-4 font-mono text-[11.5px] tracking-[0.06em] text-white/45">
				flow &nbsp;&rarr;&nbsp; <span class="text-commerce">attacker</span> spawns payload &nbsp;&middot;&nbsp; <span class="text-[#7fc4ff]">neighbor</span> serves traffic &nbsp;&middot;&nbsp; <span class="text-[#9ad7ff]">signal</span> measures blast radius
			</p>
		</div>
	</div>
</section>
