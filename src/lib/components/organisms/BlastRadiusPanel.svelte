<script lang="ts">
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

<Panel title="Blast-radius scenarios" subtitle="Lab v2" class="lg:col-span-7">
	<div class="grid gap-3 md:grid-cols-2">
		<div class="rounded-xl border border-divider p-4">
			<span class="block text-sm font-bold text-ink">Baseline customer</span>
			<p class="m-0 mt-2 mb-3 min-h-12 text-sm leading-relaxed text-body-gray">
				Probe <code>victim-checkout</code> directly to confirm the neighbor service is healthy before any payload runs.
			</p>
			<Button variant="ghost" onclick={onCustomerProbe} disabled={busy}>Probe checkout</Button>
		</div>

		<div class="rounded-xl border border-divider p-4">
			<span class="block text-sm font-bold text-ink">B1 &middot; Cryptominer</span>
			<p class="m-0 mt-2 mb-3 min-h-12 text-sm leading-relaxed text-body-gray">
				Spawn 4 short-lived CPU miners. Without rule 5.12, scheduler contention can leak into customer latency.
			</p>
			<Button onclick={onCpuBlast} disabled={busy}>Deploy cryptominer</Button>
		</div>

		<div class="rounded-xl border border-divider p-4">
			<span class="block text-sm font-bold text-ink">B2 &middot; Memory blast</span>
			<p class="m-0 mt-2 mb-3 min-h-12 text-sm leading-relaxed text-body-gray">
				Allocate 1280 MiB inside the attacker. After rule 5.11, only the attacker is OOM-killed &mdash; the host stays safe.
			</p>
			<Button onclick={onMemoryBlast} disabled={busy}>Trigger memory blast</Button>
		</div>

		<div class="rounded-xl border border-divider p-4">
			<span class="block text-sm font-bold text-ink">B3 &middot; Secret theft</span>
			<p class="m-0 mt-2 mb-3 min-h-12 text-sm leading-relaxed text-body-gray">
				Locate the postgres neighbor PID and read <code>/proc/&lt;pid&gt;/environ</code> to leak <code>POSTGRES_PASSWORD</code>.
			</p>
			<Button variant="commerce" onclick={onStealSecrets} disabled={busy}>Steal neighbor secrets</Button>
		</div>

		<div class="rounded-xl border border-divider p-4 md:col-span-2">
			<span class="block text-sm font-bold text-ink">B4 &middot; Reverse-proxy sabotage</span>
			<p class="m-0 mt-2 mb-3 min-h-12 text-sm leading-relaxed text-body-gray">
				Send <code>SIGSTOP</code> to the host caddy process &mdash; the lab UI disconnects briefly until an automatic <code>SIGCONT</code> resumes it. Use as a fallback only.
			</p>
			<Button variant="commerce" onclick={onSabotageProxy} disabled={busy}>Stop caddy briefly</Button>
		</div>
	</div>
</Panel>
