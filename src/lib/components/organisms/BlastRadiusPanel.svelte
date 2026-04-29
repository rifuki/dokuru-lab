<script lang="ts">
	import { Activity, Cpu, KeyRound, MemoryStick, Network, ShieldOff } from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';

	type Props = {
		running: string;
		onCustomerProbe: () => void | Promise<void>;
		onCpuBlast: () => void | Promise<void>;
		onMemoryBlast: () => void | Promise<void>;
		onStealSecrets: () => void | Promise<void>;
		onSabotageProxy: () => void | Promise<void>;
	};

	let {
		running,
		onCustomerProbe,
		onCpuBlast,
		onMemoryBlast,
		onStealSecrets,
		onSabotageProxy
	}: Props = $props();

	const busy = $derived(Boolean(running));
</script>

<Panel title="Blast-radius scenarios" subtitle="Lab v2" class="@4xl/main:col-span-7">
	<div class="grid gap-3 @xl/main:grid-cols-2">
		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-playstation-blue/10 text-playstation-blue" aria-hidden="true">
					<Activity size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">Baseline customer</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Probe <code>victim-checkout</code> directly to confirm the neighbor service is healthy before any payload runs.
			</p>
			<Button size="sm" variant="ghost" onclick={onCustomerProbe} disabled={busy}>Probe checkout</Button>
		</article>

		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<Cpu size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B1</span>
					<span class="ml-1.5">Cryptominer</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Spawn 4 short-lived CPU miners. Without rule 5.12, scheduler contention can leak into customer latency.
			</p>
			<Button size="sm" onclick={onCpuBlast} disabled={busy}>Deploy cryptominer</Button>
		</article>

		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<MemoryStick size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B2</span>
					<span class="ml-1.5">Memory blast</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Allocate 1280 MiB inside the attacker. After rule 5.11, only the attacker is OOM-killed &mdash; the host stays safe.
			</p>
			<Button size="sm" onclick={onMemoryBlast} disabled={busy}>Trigger memory blast</Button>
		</article>

		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<KeyRound size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B3</span>
					<span class="ml-1.5">Secret theft</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Locate the postgres neighbor PID and read <code>/proc/&lt;pid&gt;/environ</code> to leak <code>POSTGRES_PASSWORD</code>.
			</p>
			<Button size="sm" variant="commerce" onclick={onStealSecrets} disabled={busy}>Steal neighbor secrets</Button>
		</article>

		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)] @xl/main:col-span-2">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<Network size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B4</span>
					<span class="ml-1.5">Reverse-proxy sabotage</span>
				</span>
				<span class="ml-auto inline-flex items-center gap-1 font-mono text-[10.5px] text-body-gray" title="Use as fallback only">
					<ShieldOff size={11} strokeWidth={2} />
					fallback
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Send <code>SIGSTOP</code> to the host caddy process &mdash; the lab UI disconnects briefly until an automatic <code>SIGCONT</code> resumes it. Use as a fallback only.
			</p>
			<Button size="sm" variant="commerce" onclick={onSabotageProxy} disabled={busy}>Stop caddy briefly</Button>
		</article>
	</div>
</Panel>
