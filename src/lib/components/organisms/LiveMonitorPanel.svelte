<script lang="ts">
	import { Boxes, Cpu, Hash, MemoryStick } from '@lucide/svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { RuntimeEvidence } from '$lib/types/lab';

	type Props = {
		runtime?: RuntimeEvidence;
		lastUpdated: string;
		connected: boolean;
	};

	let { runtime, lastUpdated, connected }: Props = $props();

	function asNumber(value?: string): number | null {
		if (!value || value === 'max' || value === 'unavailable') return null;
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : null;
	}

	function isUnlimited(value?: string): boolean {
		const parsed = asNumber(value);
		return !value || value === 'max' || value === 'unavailable' || (parsed !== null && parsed > 1_000_000_000_000_000);
	}

	function percent(current?: string, max?: string): number {
		const currentValue = asNumber(current) ?? 0;
		const maxValue = asNumber(max);
		if (!maxValue || isUnlimited(max)) return 0;
		return Math.min(100, Math.round((currentValue / maxValue) * 100));
	}

	function formatBytes(value?: string): string {
		if (!value || value === 'unavailable') return 'unavailable';
		if (isUnlimited(value)) return 'unlimited';
		const bytes = asNumber(value);
		if (bytes === null) return value;
		const mib = bytes / 1024 / 1024;
		return `${mib.toFixed(mib >= 100 ? 0 : 1)} MiB`;
	}

	function firstLine(value?: string): string {
		return value?.split('\n')[0]?.trim() || 'loading';
	}
</script>

<Panel
	title="Live resource monitor"
	subtitle={connected ? `WebSocket live ${lastUpdated}` : 'WebSocket reconnecting'}
>
	<div class="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
		<article class="relative overflow-hidden rounded-[19px] border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-black/10">
			<div class="mb-5 flex items-start justify-between gap-3">
				<div class="flex items-center gap-3">
					<span class="grid h-10 w-10 place-items-center rounded-xl bg-playstation-blue/10 text-playstation-blue transition-colors group-hover:bg-playstation-blue/15" aria-hidden="true">
						<Hash size={18} strokeWidth={2} />
					</span>
					<div>
						<span class="block text-[15px] font-bold tracking-tight text-black">Process Limits</span>
						<span class="font-mono text-[11px] font-medium text-black/60">Rule 5.29: Restrict PIDs</span>
					</div>
				</div>
				<strong class="font-mono text-[15px] font-bold text-black tabular-nums">{runtime?.cgroup.pids_current || '...'} / {runtime?.cgroup.pids_max || '...'}</strong>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-black/5">
				<div class="h-full rounded-full bg-playstation-blue transition-all duration-500" style={`width: ${percent(runtime?.cgroup.pids_current, runtime?.cgroup.pids_max)}%`}></div>
			</div>
			<p class="mt-4 m-0 text-[13.5px] leading-relaxed text-black/70">
				PID sleepers: <strong class="font-mono font-bold text-black">{runtime?.processes.pid_bomb_sleepers || '0'}</strong>. Run PID bomb and watch this climb.
			</p>
		</article>

		<article class="relative overflow-hidden rounded-[19px] border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-black/10">
			<div class="mb-5 flex items-start justify-between gap-3">
				<div class="flex items-center gap-3">
					<span class="grid h-10 w-10 place-items-center rounded-xl bg-playstation-cyan/15 text-[#0e7fa8] transition-colors" aria-hidden="true">
						<MemoryStick size={18} strokeWidth={2} />
					</span>
					<div>
						<span class="block text-[15px] font-bold tracking-tight text-black">Memory Sandbox</span>
						<span class="font-mono text-[11px] font-medium text-black/60">Rule 5.11: Memory Quota</span>
					</div>
				</div>
				<strong class="text-right font-mono text-[15px] font-bold text-black tabular-nums">{formatBytes(runtime?.cgroup.memory_current)}</strong>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-black/5">
				<div class="h-full rounded-full bg-playstation-cyan transition-all duration-500" style={`width: ${percent(runtime?.cgroup.memory_current, runtime?.cgroup.memory_max)}%`}></div>
			</div>
			<p class="mt-4 m-0 text-[13.5px] leading-relaxed text-black/70">
				Limit: <strong class="font-mono font-bold text-black">{formatBytes(runtime?.cgroup.memory_max)}</strong>
			</p>
		</article>

		<article class="relative overflow-hidden rounded-[19px] border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-black/10">
			<div class="mb-5 flex items-center gap-3">
				<span class="grid h-10 w-10 place-items-center rounded-xl bg-commerce/10 text-commerce transition-colors" aria-hidden="true">
					<Cpu size={18} strokeWidth={2} />
				</span>
				<div>
					<span class="block text-[15px] font-bold tracking-tight text-black">CPU Throttling</span>
					<span class="font-mono text-[11px] font-medium text-black/60">Rule 5.12: Core Isolation</span>
				</div>
			</div>
			<dl class="mt-4 grid gap-3 text-[13.5px]">
				<div class="flex justify-between gap-3 border-b border-black/5 pb-2"><dt class="font-medium text-black/70">cpu.weight</dt><dd class="m-0 font-mono font-bold text-black tabular-nums">{runtime?.cgroup.cpu_weight || '...'}</dd></div>
				<div class="flex justify-between gap-3 border-b border-black/5 pb-2"><dt class="font-medium text-black/70">cpu.max</dt><dd class="m-0 font-mono font-bold text-black tabular-nums">{runtime?.cgroup.cpu_max || '...'}</dd></div>
				<div class="flex justify-between gap-3"><dt class="font-medium text-black/70">Active burners</dt><dd class="m-0 font-mono font-bold text-black tabular-nums">{runtime?.processes.cpu_burners || '0'}</dd></div>
			</dl>
		</article>

		<article class="relative overflow-hidden rounded-[19px] border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-black/10">
			<div class="mb-5 flex items-center gap-3">
				<span class="grid h-10 w-10 place-items-center rounded-xl bg-[#9ad7ff]/30 text-[#0e7fa8] transition-colors" aria-hidden="true">
					<Boxes size={18} strokeWidth={2} />
				</span>
				<div>
					<span class="block text-[15px] font-bold tracking-tight text-black">Namespace Reality</span>
					<span class="font-mono text-[11px] font-medium text-black/60">Rules 5.16, 5.17, 5.21, 5.31</span>
				</div>
			</div>
			<dl class="mt-4 grid gap-3 text-[13.5px]">
				<div class="border-b border-black/5 pb-2"><dt class="mb-1 font-medium text-black/70">UID Mapping (User NS)</dt><dd class="m-0 break-words font-mono text-[12px] font-bold text-black">{firstLine(runtime?.uid_map)}</dd></div>
				<div class="border-b border-black/5 pb-2"><dt class="mb-1 font-medium text-black/70">PID Boundary</dt><dd class="m-0 break-words font-mono text-[12px] font-bold text-black">{runtime?.pid_namespace || 'loading'}</dd></div>
				<div class="flex justify-between gap-3"><dt class="font-medium text-black/70">Total processes visible</dt><dd class="m-0 font-mono font-bold text-black tabular-nums">{runtime?.processes.process_count || '...'}</dd></div>
			</dl>
		</article>
	</div>
</Panel>
