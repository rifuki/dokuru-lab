<script lang="ts">
	import { Activity, Cpu, KeyRound, MemoryStick, Network, ShieldOff } from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { ActivePayload } from '$lib/types/lab';

	type Props = {
		running: string;
		activePayload: ActivePayload | null;
		onCustomerProbe: () => void | Promise<void>;
		onCpuBlast: () => void | Promise<void>;
		onMemoryBlast: () => void | Promise<void>;
		onStealSecrets: () => void | Promise<void>;
		onSabotageProxy: () => void | Promise<void>;
		onStopPayloads: () => void | Promise<void>;
	};

	let {
		running,
		activePayload,
		onCustomerProbe,
		onCpuBlast,
		onMemoryBlast,
		onStealSecrets,
		onSabotageProxy,
		onStopPayloads
	}: Props = $props();

	const busy = $derived(Boolean(running));
	const scenarioBlocked = $derived(busy || Boolean(activePayload));
</script>

<Panel title="Blast-radius scenarios" subtitle="Lab v2" class="@4xl/main:col-span-7">
	{#if activePayload}
		<div class="mb-4 flex flex-col gap-3 rounded-xl border border-commerce/20 bg-commerce/5 p-3 @md/main:flex-row @md/main:items-center @md/main:justify-between">
			<div>
				<p class="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-commerce">Active payload</p>
				<p class="m-0 mt-1 text-[13px] font-medium text-ink">{activePayload.label}</p>
			</div>
			<Button size="sm" variant="commerce" onclick={onStopPayloads} disabled={running === 'stop-payloads'}>Stop payload</Button>
		</div>
	{/if}

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
				Saturate available CPU cores with short-lived miners. Watch Active burners and customer latency when no CPU quota is configured.
			</p>
			<Button size="sm" onclick={onCpuBlast} disabled={scenarioBlocked}>Deploy cryptominer</Button>
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
				Start a child process that holds 1280 MiB. Use Stop payload to terminate it; with rule 5.11, only that process is OOM-killed.
			</p>
			<Button size="sm" onclick={onMemoryBlast} disabled={scenarioBlocked}>Trigger memory blast</Button>
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
			<Button size="sm" variant="commerce" onclick={onSabotageProxy} disabled={scenarioBlocked}>Stop caddy briefly</Button>
		</article>
	</div>
</Panel>
