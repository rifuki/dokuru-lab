<script lang="ts">
	import { Boxes, Cpu, FileSearch, PenLine, RefreshCw, User } from '@lucide/svelte';
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

<Panel title="Runtime evidence" subtitle={ok ? 'Ready' : 'Check'} class="@4xl/main:col-span-5">
	<p class="m-0 mb-4 text-sm leading-relaxed text-body-gray">
		Use this card for the quick oral explanation: what user the app runs as, which namespaces it sees, and whether bind-mounted data is still writable after hardening.
	</p>
	<dl class="grid gap-0">
		<div class="grid grid-cols-[24px_92px_minmax(0,1fr)] items-start gap-3 border-b border-divider py-2.5">
			<User size={13} strokeWidth={2.2} class="mt-0.5 text-body-gray" />
			<dt class="text-[13px] text-body-gray">User</dt>
			<dd class="m-0 break-words font-mono text-[12px] leading-relaxed text-ink">{runtime?.id || 'loading'}</dd>
		</div>
		<div class="grid grid-cols-[24px_92px_minmax(0,1fr)] items-start gap-3 border-b border-divider py-2.5">
			<Boxes size={13} strokeWidth={2.2} class="mt-0.5 text-body-gray" />
			<dt class="text-[13px] text-body-gray">Userns</dt>
			<dd class="m-0 break-words font-mono text-[12px] leading-relaxed text-ink">{runtime?.user_namespace || 'loading'}</dd>
		</div>
		<div class="grid grid-cols-[24px_92px_minmax(0,1fr)] items-start gap-3 border-b border-divider py-2.5">
			<Cpu size={13} strokeWidth={2.2} class="mt-0.5 text-body-gray" />
			<dt class="text-[13px] text-body-gray">cpu.weight</dt>
			<dd class="m-0 break-words font-mono text-[12px] leading-relaxed text-ink">{runtime?.cgroup.cpu_weight || 'loading'}</dd>
		</div>
		<div class="grid grid-cols-[24px_92px_minmax(0,1fr)] items-start gap-3 py-2.5">
			<FileSearch size={13} strokeWidth={2.2} class="mt-0.5 text-body-gray" />
			<dt class="text-[13px] text-body-gray">cpu.max</dt>
			<dd class="m-0 break-words font-mono text-[12px] leading-relaxed text-ink">{runtime?.cgroup.cpu_max || 'loading'}</dd>
		</div>
	</dl>

	<div class="mt-3.5 flex flex-wrap gap-2.5">
		<Button size="sm" onclick={onRefresh} disabled={running === 'health'}>
			<span class="inline-flex items-center gap-1.5">
				<RefreshCw size={12} strokeWidth={2.4} />
				Refresh
			</span>
		</Button>
		<Button variant="secondary" size="sm" onclick={onProbe} disabled={running === 'probe'}>
			<span class="inline-flex items-center gap-1.5">
				<PenLine size={12} strokeWidth={2.2} />
				Probe write
			</span>
		</Button>
	</div>
</Panel>
