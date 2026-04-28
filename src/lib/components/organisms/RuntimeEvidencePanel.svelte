<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { RuntimeEvidence } from '$lib/types/lab';

	type Props = {
		runtime?: RuntimeEvidence;
		ok: boolean;
		onRefresh: () => void | Promise<void>;
		onProbe: () => void | Promise<void>;
		running: string;
	};

	let { runtime, ok, onRefresh, onProbe, running }: Props = $props();
</script>

<Panel id="evidence" title="Runtime evidence" subtitle={ok ? 'Ready' : 'Check'} class="lg:col-span-4">
	<p class="m-0 mb-4 text-sm leading-relaxed text-body-gray">
		Use this card for the quick oral explanation: what user the app runs as, which namespaces it sees, and whether bind-mounted data is still writable after hardening.
	</p>
	<dl class="grid gap-2.5">
		<div class="grid grid-cols-[82px_minmax(0,1fr)] gap-3 border-b border-divider pb-2.5">
			<dt class="text-[13px] text-body-gray">User</dt>
			<dd class="m-0 break-words font-mono text-xs leading-relaxed">{runtime?.id || 'loading'}</dd>
		</div>
		<div class="grid grid-cols-[82px_minmax(0,1fr)] gap-3 border-b border-divider pb-2.5">
			<dt class="text-[13px] text-body-gray">Userns</dt>
			<dd class="m-0 break-words font-mono text-xs leading-relaxed">{runtime?.user_namespace || 'loading'}</dd>
		</div>
		<div class="grid grid-cols-[82px_minmax(0,1fr)] gap-3 border-b border-divider pb-2.5">
			<dt class="text-[13px] text-body-gray">cpu.weight</dt>
			<dd class="m-0 break-words font-mono text-xs leading-relaxed">{runtime?.cgroup.cpu_weight || 'loading'}</dd>
		</div>
		<div class="grid grid-cols-[82px_minmax(0,1fr)] gap-3 border-b border-divider pb-2.5">
			<dt class="text-[13px] text-body-gray">cpu.max</dt>
			<dd class="m-0 break-words font-mono text-xs leading-relaxed">{runtime?.cgroup.cpu_max || 'loading'}</dd>
		</div>
	</dl>

	<div class="mt-3.5 flex flex-wrap gap-2.5">
		<Button size="sm" onclick={onRefresh} disabled={running === 'health'}>Refresh</Button>
		<Button variant="secondary" size="sm" onclick={onProbe} disabled={running === 'probe'}>Probe write</Button>
	</div>
</Panel>
