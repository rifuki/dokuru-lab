<script lang="ts">
	import { Cpu, Hash, Layers, MemoryStick, Terminal as TerminalIcon, UserCog } from '@lucide/svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';

	const rows = [
		{
			label: 'UID map',
			icon: UserCog,
			before: '0 → 0 (root = root)',
			after: '0 → 4294967295 (remapped)'
		},
		{
			label: 'PID view',
			icon: Layers,
			before: 'host process list visible',
			after: 'only container processes'
		},
		{
			label: 'PIDs',
			icon: Hash,
			before: 'unlimited — bomb spawns freely',
			after: 'pids.max caps the bomb'
		},
		{
			label: 'Memory',
			icon: MemoryStick,
			before: 'unlimited / host-sized',
			after: 'explicit memory limit set'
		},
		{
			label: 'CPU',
			icon: Cpu,
			before: 'default shares (unthrottled)',
			after: 'explicit cpu.weight set'
		}
	] as const;
</script>

<Panel title="Before / after proof" subtitle="Isolation comparison" class="@4xl/main:col-span-7">
	<p class="m-0 mb-5 text-sm leading-relaxed text-body-gray">
		Observable differences before and after Dokuru applies container hardening rules. The application workload remains unchanged; only the isolation boundary shifts.
	</p>

	<!-- Column headers -->
	<div class="mb-2 grid grid-cols-[24px_80px_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-0">
		<span></span>
		<span></span>
		<span class="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider text-red-500">
			<span class="inline-block h-1.5 w-1.5 rounded-full bg-red-400"></span>
			Before
		</span>
		<span class="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider text-emerald-600">
			<span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
			After
		</span>
	</div>

	<dl class="grid gap-0">
		{#each rows as { label, icon: Icon, before, after } (label)}
			<div class="grid grid-cols-[24px_80px_minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 border-b border-divider py-3 last:border-b-0">
				<Icon size={15} strokeWidth={1.5} class="mt-0.5 text-body-gray" />
				<dt class="text-[13px] font-semibold text-ink">{label}</dt>
				<!-- Before: red tint -->
				<dd class="m-0 rounded-md bg-red-50/70 px-2 py-1 font-mono text-[11.5px] leading-snug text-red-700">{before}</dd>
				<!-- After: green tint -->
				<dd class="m-0 rounded-md bg-emerald-50/70 px-2 py-1 font-mono text-[11.5px] leading-snug text-emerald-700">{after}</dd>
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
