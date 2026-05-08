<script lang="ts">
	import { onMount } from 'svelte';
	import { Boxes, Cpu, Hash, MemoryStick } from '@lucide/svelte';
	import type { RuntimeEvidence } from '$lib/types/lab';

	type Props = {
		runtime?: RuntimeEvidence;
		connected: boolean;
		lastUpdated: string;
		onClose?: () => void;
	};

	let { runtime, connected, lastUpdated, onClose }: Props = $props();
	let hostInfo = $state({ cpu_cores: 0, cpu_usage_percent: 0, memory_total_gb: 0, memory_available_gb: 0 });

	onMount(() => {
		void fetchHostInfo();
		const interval = window.setInterval(fetchHostInfo, 3000);
		return () => window.clearInterval(interval);
	});

	async function fetchHostInfo() {
		try {
			const response = await fetch('/api/monitor/host');
			if (response.ok) hostInfo = await response.json();
		} catch {
			/* keep last host sample */
		}
	}

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
		if (!value || value === 'unavailable') return '—';
		if (isUnlimited(value)) return 'unlimited';
		const bytes = asNumber(value);
		if (bytes === null) return value;
		const mib = bytes / 1024 / 1024;
		return `${mib.toFixed(mib >= 100 ? 0 : 1)} MiB`;
	}

	function firstLine(value?: string): string {
		return value?.split('\n')[0]?.trim() || '—';
	}

	function hostMemoryUsedPercent(): number {
		if (!hostInfo.memory_total_gb) return 0;
		return Math.min(100, Math.round(((hostInfo.memory_total_gb - hostInfo.memory_available_gb) / hostInfo.memory_total_gb) * 100));
	}

	const pidPct = $derived(percent(runtime?.cgroup.pids_current, runtime?.cgroup.pids_max));
	const memPct = $derived(percent(runtime?.cgroup.memory_current, runtime?.cgroup.memory_max));
	const hostCpuPct = $derived(Math.max(0, Math.min(100, Math.round(hostInfo.cpu_usage_percent || 0))));
	const hostMemPct = $derived(hostMemoryUsedPercent());
</script>

<!-- Compact status strip -->
<div class="flex items-center justify-between border-b border-white/5 px-4 py-1.5 min-h-[32px]">
	<span class="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-white/40">Monitor</span>
	{#if onClose}
		<button
			type="button"
			onclick={onClose}
			aria-label="Close"
			title="Close panel"
			class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/35 transition hover:bg-white/10 hover:text-white"
		>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
		</button>
	{/if}
</div>

<!-- Metrics -->
<div class="flex-1 overflow-auto px-4 py-4 space-y-2">

	<!-- PIDs row -->
	<div class="rounded-xl bg-white/[0.04] px-4 py-3">
		<div class="mb-2 flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<span class="grid h-6 w-6 place-items-center rounded-md bg-playstation-blue/25 text-[#7ab8f5]" aria-hidden="true">
					<Hash size={12} strokeWidth={1.5} />
				</span>
				<span class="font-mono text-[10px] uppercase tracking-[0.08em] text-white/50">PIDs</span>
				<span class="font-mono text-[10px] text-white/25">5.29</span>
			</div>
			<span class="font-mono text-[11.5px] font-medium text-white tabular-nums">
				{runtime?.cgroup.pids_current || '—'} / {runtime?.cgroup.pids_max || '—'}
			</span>
		</div>
		<div class="h-1 overflow-hidden rounded-full bg-white/10">
			<div class="h-full rounded-full bg-playstation-blue transition-all duration-500" style={`width: ${pidPct}%`}></div>
		</div>
		<div class="mt-2 flex justify-between">
			<span class="font-mono text-[10px] text-white/35">sleepers</span>
			<span class="font-mono text-[10px] text-white/70 tabular-nums">{runtime?.processes.pid_bomb_sleepers || '0'}</span>
		</div>
	</div>

	<!-- CPU row -->
	<div class="rounded-xl bg-white/[0.04] px-4 py-3">
		<div class="mb-2 flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<span class="grid h-6 w-6 place-items-center rounded-md bg-commerce/20 text-[#f08060]" aria-hidden="true">
					<Cpu size={12} strokeWidth={1.5} />
				</span>
				<span class="font-mono text-[10px] uppercase tracking-[0.08em] text-white/50">Host CPU</span>
			</div>
			<span class="font-mono text-[11.5px] font-medium text-white tabular-nums">{hostCpuPct}%</span>
		</div>
		<div class="h-1 overflow-hidden rounded-full bg-white/10">
			<div class="h-full rounded-full bg-commerce transition-all duration-500" style={`width: ${hostCpuPct}%`}></div>
		</div>
		<div class="mt-2 grid gap-1.5">
			<div class="flex justify-between gap-2">
				<span class="font-mono text-[10px] text-white/35">cores</span>
				<span class="font-mono text-[10px] text-white/70 tabular-nums">{hostInfo.cpu_cores || '—'}</span>
			</div>
			<div class="flex justify-between gap-2">
				<span class="font-mono text-[10px] text-white/35">container cpu.max</span>
				<span class="font-mono text-[10px] text-white/70 tabular-nums">{runtime?.cgroup.cpu_max || '—'}</span>
			</div>
			<div class="flex justify-between gap-2">
				<span class="font-mono text-[10px] text-white/35">burners</span>
				<span class="font-mono text-[10px] text-white/70 tabular-nums">{runtime?.processes.cpu_burners || '0'}</span>
			</div>
		</div>
	</div>

	<!-- Memory row -->
	<div class="rounded-xl bg-white/[0.04] px-4 py-3">
		<div class="mb-2 flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<span class="grid h-6 w-6 place-items-center rounded-md bg-playstation-cyan/20 text-[#9ad7ff]" aria-hidden="true">
					<MemoryStick size={12} strokeWidth={1.5} />
				</span>
				<span class="font-mono text-[10px] uppercase tracking-[0.08em] text-white/50">Memory</span>
				<span class="font-mono text-[10px] text-white/25">5.11</span>
			</div>
			<span class="font-mono text-[11.5px] font-medium text-white tabular-nums">
				{hostInfo.memory_total_gb ? `${hostMemPct}% host` : '—'}
			</span>
		</div>
		<div class="h-1 overflow-hidden rounded-full bg-white/10">
			<div class="h-full rounded-full bg-playstation-cyan transition-all duration-500" style={`width: ${hostMemPct}%`}></div>
		</div>
		<div class="mt-2 grid gap-1.5">
			<div class="flex justify-between gap-2">
				<span class="font-mono text-[10px] text-white/35">host avail / total</span>
				<span class="font-mono text-[10px] text-white/70 tabular-nums">{hostInfo.memory_available_gb || '—'} / {hostInfo.memory_total_gb || '—'} GiB</span>
			</div>
			<div class="flex justify-between gap-2">
				<span class="font-mono text-[10px] text-white/35">container used</span>
				<span class="font-mono text-[10px] text-white/70 tabular-nums">{formatBytes(runtime?.cgroup.memory_current)}</span>
			</div>
			<div class="flex justify-between gap-2">
				<span class="font-mono text-[10px] text-white/35">container limit</span>
				<span class="font-mono text-[10px] text-white/70 tabular-nums">{formatBytes(runtime?.cgroup.memory_max)}</span>
			</div>
		</div>
	</div>

	<!-- Namespace row -->
	<div class="rounded-xl bg-white/[0.04] px-4 py-3">
		<div class="mb-3 flex items-center gap-2">
			<span class="grid h-6 w-6 place-items-center rounded-md bg-[#9ad7ff]/15 text-[#9ad7ff]" aria-hidden="true">
				<Boxes size={12} strokeWidth={1.5} />
			</span>
			<span class="font-mono text-[10px] uppercase tracking-[0.08em] text-white/50">Namespace</span>
		</div>
		<dl class="grid gap-1.5">
			<div class="flex justify-between gap-2">
				<dt class="font-mono text-[10px] text-white/35">UID map</dt>
				<dd class="m-0 max-w-[55%] truncate font-mono text-[10px] text-white/70 tabular-nums text-right">{firstLine(runtime?.uid_map)}</dd>
			</div>
			<div class="flex justify-between gap-2">
				<dt class="font-mono text-[10px] text-white/35">PID ns</dt>
				<dd class="m-0 max-w-[55%] truncate font-mono text-[10px] text-white/70 tabular-nums text-right">{runtime?.pid_namespace || '—'}</dd>
			</div>
			<div class="flex justify-between gap-2">
				<dt class="font-mono text-[10px] text-white/35">visible procs</dt>
				<dd class="m-0 font-mono text-[10px] text-white/70 tabular-nums">{runtime?.processes.process_count || '—'}</dd>
			</div>
		</dl>
	</div>
</div>
