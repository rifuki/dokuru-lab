<script lang="ts">
	import { Cpu, Hash, Layers, MemoryStick, Terminal as TerminalIcon, UserCog } from '@lucide/svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';

	const rows = [
		{ label: 'UID map', icon: UserCog, body: 'Before: <code>0 0</code>. After: remapped host UID range.' },
		{ label: 'PID view', icon: Layers, body: 'Before: host process list. After: only container processes.' },
		{ label: 'PIDs', icon: Hash, body: 'Before: many sleepers spawn. After: <code>pids.max</code> caps the bomb.' },
		{ label: 'Memory', icon: MemoryStick, body: 'Before: unlimited or host-sized. After: explicit memory limit.' },
		{ label: 'CPU', icon: Cpu, body: 'Before: default shares. After: explicit CPU shares/weight.' }
	] as const;
</script>

<Panel title="Before / after proof" subtitle="Isolation comparison" class="@4xl/main:col-span-7">
	<p class="m-0 mb-4 text-sm leading-relaxed text-body-gray">
		Observable differences before and after Dokuru applies container hardening rules. The application workload remains unchanged; only the isolation boundary shifts.
	</p>
	<dl class="grid gap-0">
		{#each rows as { label, icon: Icon, body } (label)}
			<div class="grid grid-cols-[24px_96px_minmax(0,1fr)] items-start gap-3 border-b border-divider py-2.5 last:border-b-0">
				<Icon size={16} strokeWidth={1.5} class="mt-0.5 text-body-gray" />
				<dt class="text-[13px] font-medium text-ink">{label}</dt>
				<dd class="m-0 text-[13px] leading-relaxed text-body-gray">{@html body}</dd>
			</div>
		{/each}
	</dl>

	<div class="mt-4 flex items-center gap-2.5 rounded-[12px] bg-ice p-3.5">
		<span class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-black text-white" aria-hidden="true">
			<TerminalIcon size={16} strokeWidth={1.5} />
		</span>
		<div class="min-w-0">
			<span class="block text-[12px] text-body-gray">Inspect baseline</span>
			<code class="break-words font-mono text-[12.5px] text-ink">docker inspect dokuru-lab</code>
		</div>
	</div>
</Panel>
