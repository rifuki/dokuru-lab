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
	<div class="grid gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
		<article class="rounded-[12px] border border-divider bg-ice p-4 transition-colors hover:border-black/12">
			<div class="mb-3 flex items-start justify-between gap-3">
				<div class="flex items-center gap-2.5">
					<span class="grid h-7 w-7 place-items-center rounded-md bg-playstation-blue/12 text-playstation-blue" aria-hidden="true">
						<Hash size={13} strokeWidth={2.4} />
					</span>
					<div>
						<span class="block text-[13px] font-medium text-ink">PIDs</span>
						<span class="font-mono text-[10.5px] text-body-gray">Rule 5.29</span>
					</div>
				</div>
				<strong class="font-mono text-[12.5px] text-ink tabular-nums">{runtime?.cgroup.pids_current || '...'} / {runtime?.cgroup.pids_max || '...'}</strong>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-white">
				<div class="h-full rounded-full bg-playstation-blue transition-all" style={`width: ${percent(runtime?.cgroup.pids_current, runtime?.cgroup.pids_max)}%`}></div>
			</div>
			<p class="mt-3 m-0 text-[12px] leading-relaxed text-body-gray">
				PID sleepers: <strong class="font-mono text-ink">{runtime?.processes.pid_bomb_sleepers || '0'}</strong>. Run PID bomb and watch this climb.
			</p>
		</article>

		<article class="rounded-[12px] border border-divider bg-ice p-4 transition-colors hover:border-black/12">
			<div class="mb-3 flex items-start justify-between gap-3">
				<div class="flex items-center gap-2.5">
					<span class="grid h-7 w-7 place-items-center rounded-md bg-playstation-cyan/15 text-[#0e7fa8]" aria-hidden="true">
						<MemoryStick size={13} strokeWidth={2.2} />
					</span>
					<div>
						<span class="block text-[13px] font-medium text-ink">Memory</span>
						<span class="font-mono text-[10.5px] text-body-gray">Rule 5.11</span>
					</div>
				</div>
				<strong class="text-right font-mono text-[12.5px] text-ink tabular-nums">{formatBytes(runtime?.cgroup.memory_current)}</strong>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-white">
				<div class="h-full rounded-full bg-playstation-cyan transition-all" style={`width: ${percent(runtime?.cgroup.memory_current, runtime?.cgroup.memory_max)}%`}></div>
			</div>
			<p class="mt-3 m-0 text-[12px] leading-relaxed text-body-gray">
				Limit: <strong class="font-mono text-ink">{formatBytes(runtime?.cgroup.memory_max)}</strong>
			</p>
		</article>

		<article class="rounded-[12px] border border-divider bg-ice p-4 transition-colors hover:border-black/12">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/12 text-commerce" aria-hidden="true">
					<Cpu size={13} strokeWidth={2.2} />
				</span>
				<div>
					<span class="block text-[13px] font-medium text-ink">CPU</span>
					<span class="font-mono text-[10.5px] text-body-gray">Rule 5.12</span>
				</div>
			</div>
			<dl class="mt-3 grid gap-2 text-[12px]">
				<div class="flex justify-between gap-3"><dt class="text-body-gray">cpu.weight</dt><dd class="m-0 font-mono text-ink tabular-nums">{runtime?.cgroup.cpu_weight || '...'}</dd></div>
				<div class="flex justify-between gap-3"><dt class="text-body-gray">cpu.max</dt><dd class="m-0 font-mono text-ink tabular-nums">{runtime?.cgroup.cpu_max || '...'}</dd></div>
				<div class="flex justify-between gap-3"><dt class="text-body-gray">burners</dt><dd class="m-0 font-mono text-ink tabular-nums">{runtime?.processes.cpu_burners || '0'}</dd></div>
			</dl>
		</article>

		<article class="rounded-[12px] border border-divider bg-ice p-4 transition-colors hover:border-black/12">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-[#9ad7ff]/30 text-[#0e7fa8]" aria-hidden="true">
					<Boxes size={13} strokeWidth={2.2} />
				</span>
				<div>
					<span class="block text-[13px] font-medium text-ink">Namespace</span>
					<span class="font-mono text-[10.5px] text-body-gray">Rules 2.10, 5.16, 5.17, 5.21, 5.31</span>
				</div>
			</div>
			<dl class="mt-3 grid gap-2 text-[12px]">
				<div><dt class="text-body-gray">UID map</dt><dd class="m-0 break-words font-mono text-ink">{firstLine(runtime?.uid_map)}</dd></div>
				<div><dt class="text-body-gray">PID ns</dt><dd class="m-0 break-words font-mono text-ink">{runtime?.pid_namespace || 'loading'}</dd></div>
				<div><dt class="text-body-gray">Processes visible</dt><dd class="m-0 font-mono text-ink tabular-nums">{runtime?.processes.process_count || '...'}</dd></div>
			</dl>
		</article>
	</div>
</Panel>
