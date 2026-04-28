<script lang="ts">
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
	id="monitor"
	title="Live resource monitor"
	subtitle={connected ? `WebSocket live ${lastUpdated}` : 'WebSocket reconnecting'}
	class="lg:col-span-12"
>
	<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
		<div class="rounded-xl border border-divider bg-ice p-4">
			<div class="mb-3 flex items-start justify-between gap-3">
				<div>
					<span class="block text-sm font-bold text-ink">PIDs</span>
					<span class="text-xs text-body-gray">Rule 5.29 proof</span>
				</div>
				<strong class="font-mono text-sm text-ink">{runtime?.cgroup.pids_current || '...'} / {runtime?.cgroup.pids_max || '...'}</strong>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-white">
				<div class="h-full rounded-full bg-playstation-blue transition-all" style={`width: ${percent(runtime?.cgroup.pids_current, runtime?.cgroup.pids_max)}%`}></div>
			</div>
			<p class="mt-3 m-0 text-xs leading-relaxed text-body-gray">
				PID sleepers: <strong class="font-mono text-ink">{runtime?.processes.pid_bomb_sleepers || '0'}</strong>. Run PID bomb and watch this climb.
			</p>
		</div>

		<div class="rounded-xl border border-divider bg-ice p-4">
			<div class="mb-3 flex items-start justify-between gap-3">
				<div>
					<span class="block text-sm font-bold text-ink">Memory</span>
					<span class="text-xs text-body-gray">Rule 5.11 proof</span>
				</div>
				<strong class="text-right font-mono text-sm text-ink">{formatBytes(runtime?.cgroup.memory_current)}</strong>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-white">
				<div class="h-full rounded-full bg-playstation-cyan transition-all" style={`width: ${percent(runtime?.cgroup.memory_current, runtime?.cgroup.memory_max)}%`}></div>
			</div>
			<p class="mt-3 m-0 text-xs leading-relaxed text-body-gray">
				Limit: <strong class="font-mono text-ink">{formatBytes(runtime?.cgroup.memory_max)}</strong>
			</p>
		</div>

		<div class="rounded-xl border border-divider bg-ice p-4">
			<span class="block text-sm font-bold text-ink">CPU</span>
			<span class="text-xs text-body-gray">Rule 5.12 proof</span>
			<dl class="mt-3 grid gap-2 text-xs">
				<div class="flex justify-between gap-3"><dt class="text-body-gray">cpu.weight</dt><dd class="m-0 font-mono text-ink">{runtime?.cgroup.cpu_weight || '...'}</dd></div>
				<div class="flex justify-between gap-3"><dt class="text-body-gray">cpu.max</dt><dd class="m-0 font-mono text-ink">{runtime?.cgroup.cpu_max || '...'}</dd></div>
				<div class="flex justify-between gap-3"><dt class="text-body-gray">burners</dt><dd class="m-0 font-mono text-ink">{runtime?.processes.cpu_burners || '0'}</dd></div>
			</dl>
		</div>

		<div class="rounded-xl border border-divider bg-ice p-4">
			<span class="block text-sm font-bold text-ink">Namespace</span>
			<span class="text-xs text-body-gray">Rules 2.10, 5.16, 5.17, 5.21, 5.31</span>
			<dl class="mt-3 grid gap-2 text-xs">
				<div><dt class="text-body-gray">UID map</dt><dd class="m-0 break-words font-mono text-ink">{firstLine(runtime?.uid_map)}</dd></div>
				<div><dt class="text-body-gray">PID ns</dt><dd class="m-0 break-words font-mono text-ink">{runtime?.pid_namespace || 'loading'}</dd></div>
				<div><dt class="text-body-gray">Processes visible</dt><dd class="m-0 font-mono text-ink">{runtime?.processes.process_count || '...'}</dd></div>
			</dl>
		</div>
	</div>
</Panel>
