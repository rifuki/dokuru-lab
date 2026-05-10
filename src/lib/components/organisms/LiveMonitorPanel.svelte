<script lang="ts">
	import { onMount } from 'svelte';
	import { Boxes, Cpu, Hash, MemoryStick } from '@lucide/svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { RuntimeEvidence } from '$lib/types/lab';

	type Props = {
		runtime?: RuntimeEvidence;
		lastUpdated: string;
		connected: boolean;
	};

	let { runtime, lastUpdated, connected }: Props = $props();

	// Host resource info
	let hostInfo = $state({ cpu_cores: 0, cpu_usage_percent: 0, memory_total_gb: 0, memory_available_gb: 0 });
	
	async function fetchHostInfo() {
		try {
			const res = await fetch('/api/monitor/host');
			if (res.ok) {
				hostInfo = await res.json();
			}
		} catch (e) {
			console.error('Failed to fetch host info:', e);
		}
	}
	
	onMount(() => {
		fetchHostInfo();
		const interval = setInterval(fetchHostInfo, 3000); // Update every 3s
		return () => clearInterval(interval);
	});

	function asNumber(value?: string): number | null {
		if (!value || value === 'max' || value === 'unavailable') return null;
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : null;
	}

	function isUnlimited(value?: string): boolean {
		// Do not show unlimited warnings if data is missing or loading
		if (!value || value === 'unavailable') return false;
		const parsed = asNumber(value);
		return value === 'max' || (parsed !== null && parsed > 1_000_000_000_000_000);
	}

	const memUnlimited = $derived(!!runtime?.cgroup.memory_max && isUnlimited(runtime.cgroup.memory_max));
	const pidsUnlimited = $derived(!!runtime?.cgroup.pids_max && isUnlimited(runtime.cgroup.pids_max));
	const cpuUnthrottled = $derived(!!runtime?.cgroup.cpu_max && (runtime.cgroup.cpu_max === 'max 100000' || isUnlimited(runtime.cgroup.cpu_max)));

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

	function formatMemoryLimit(value?: string): string {
		if (!value || value === 'unavailable') return 'unavailable';
		return isUnlimited(value) ? 'Not configured' : formatBytes(value);
	}

	function formatPidLimit(value?: string): string {
		if (!value || value === 'unavailable') return '...';
		return isUnlimited(value) ? 'unlimited' : value;
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

		<!-- Card 1: Process Limits -->
		<article class={`relative overflow-hidden rounded-[19px] border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
			pidsUnlimited
				? 'border-amber-400/50 bg-amber-50/30'
				: 'border-black/5 bg-white hover:border-black/10'
		}`}>
			<div class="mb-5 flex items-start justify-between gap-3">
				<div class="flex items-center gap-3">
					<span class={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
						pidsUnlimited ? 'bg-amber-400/20 text-amber-600' : 'bg-playstation-blue/10 text-playstation-blue group-hover:bg-playstation-blue/15'
					}`} aria-hidden="true">
						<Hash size={18} strokeWidth={2} />
					</span>
					<div>
						<span class="block text-[15px] font-bold tracking-tight text-black">Process Limits</span>
						<span class="font-mono text-[11px] font-medium text-black/60">Rule 5.29: Restrict PIDs</span>
					</div>
				</div>
				<div class="flex flex-col items-end gap-1.5">
					<strong class="font-mono text-[15px] font-bold text-black tabular-nums">{runtime?.cgroup.pids_current || '...'} / {formatPidLimit(runtime?.cgroup.pids_max)}</strong>
				</div>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-black/5">
				{#if pidsUnlimited}
					<div class="h-full w-full rounded-full bg-amber-400/80"></div>
				{:else}
					<div class="h-full rounded-full bg-playstation-blue transition-all duration-500" style={`width: ${percent(runtime?.cgroup.pids_current, runtime?.cgroup.pids_max)}%`}></div>
				{/if}
			</div>
			{#if pidsUnlimited}
				<div class="mt-4 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2">
					<span class="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">Limit status</span>
					<p class="m-0 mt-1 text-[13px] font-medium text-black/75">PID limit is not configured</p>
				</div>
			{/if}
			<p class="mt-4 m-0 text-[13.5px] leading-relaxed text-black/70">
				PID sleepers: <strong class="font-mono font-bold text-black">{runtime?.processes.pid_bomb_sleepers || '0'}</strong>. Run PID bomb and watch this climb.
			</p>
		</article>

		<!-- Card 2: Memory Sandbox — RED when unlimited (CIS 5.11 violation) -->
		<article class={`relative overflow-hidden rounded-[19px] border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
			memUnlimited
				? 'border-red-400/50 bg-red-50/30'
				: 'border-black/5 bg-white hover:border-black/10'
		}`}>
			<div class="mb-5 flex items-start justify-between gap-3">
				<div class="flex items-center gap-3">
					<span class={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
						memUnlimited ? 'bg-red-400/20 text-red-600' : 'bg-playstation-cyan/15 text-[#0e7fa8]'
					}`} aria-hidden="true">
						<MemoryStick size={18} strokeWidth={2} />
					</span>
					<div>
						<span class="block text-[15px] font-bold tracking-tight text-black">Memory Limit</span>
						<span class="font-mono text-[11px] font-medium text-black/60">Rule 5.11: Memory Quota</span>
					</div>
				</div>
				<div class="flex flex-col items-end gap-1.5">
					<strong class="text-right font-mono text-[15px] font-bold text-black tabular-nums">
						{formatBytes(runtime?.cgroup.memory_current)}
					</strong>
				</div>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-black/5">
				{#if memUnlimited}
					<div class="h-full w-full rounded-full bg-red-400/80"></div>
				{:else}
					<div class="h-full rounded-full bg-playstation-cyan transition-all duration-500" style={`width: ${percent(runtime?.cgroup.memory_current, runtime?.cgroup.memory_max)}%`}></div>
				{/if}
			</div>
			<div class="mt-4 grid gap-3 text-[13.5px]">
				<div class="rounded-lg bg-black/5 p-3">
					<dt class="mb-2 font-semibold text-black/80">Host Memory</dt>
					<div class="grid gap-2 text-[12.5px]">
						<div class="flex justify-between gap-3">
							<span class="text-black/70">Total</span>
							<span class="font-mono font-bold text-black">{hostInfo.memory_total_gb} GB</span>
						</div>
						<div class="flex justify-between gap-3">
							<span class="text-black/70">Available</span>
							<span class="font-mono font-bold text-black">{hostInfo.memory_available_gb} GB</span>
						</div>
					</div>
				</div>
				<div class={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
					memUnlimited ? 'border border-red-200/80 bg-red-50' : 'border border-black/5 bg-white/70'
				}`}>
					<span class="text-[13px] font-medium text-black/65">Container limit</span>
					<strong class={`text-right font-mono text-[13px] font-bold ${memUnlimited ? 'text-red-600' : 'text-black'}`}>{formatMemoryLimit(runtime?.cgroup.memory_max)}</strong>
				</div>
				{#if !memUnlimited}
				<div class="flex items-center justify-between gap-3 px-3 py-2">
					<span class="text-[13px] font-medium text-black/65">Usage</span>
					<strong class="text-right font-mono text-[13px] font-bold text-black">{percent(runtime?.cgroup.memory_current, runtime?.cgroup.memory_max)}%</strong>
				</div>
				{/if}
			</div>
		</article>

		<!-- Card 3: CPU Pressure -->
		<article class={`relative overflow-hidden rounded-[19px] border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
			cpuUnthrottled
				? 'border-amber-400/50 bg-amber-50/30'
				: 'border-black/5 bg-white hover:border-black/10'
		}`}>
			<div class="mb-5 flex items-start justify-between gap-3">
				<div class="flex items-center gap-3">
					<span class={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
						cpuUnthrottled ? 'bg-amber-400/20 text-amber-600' : 'bg-commerce/10 text-commerce'
					}`} aria-hidden="true">
						<Cpu size={18} strokeWidth={2} />
					</span>
					<div>
						<span class="block text-[15px] font-bold tracking-tight text-black">CPU Pressure / Limit</span>
						<span class="font-mono text-[11px] font-medium text-black/60">Rule 5.12: Core Isolation</span>
					</div>
				</div>
			</div>
			<dl class="mt-4 grid gap-3 text-[13.5px]">
				<div class="rounded-lg bg-black/5 p-3">
					<dt class="mb-2 font-semibold text-black/80">Host Resources</dt>
					<div class="grid gap-2 text-[12.5px]">
						<div class="flex justify-between gap-3">
							<span class="text-black/70">Total cores</span>
							<span class="font-mono font-bold text-black">{hostInfo.cpu_cores}</span>
						</div>
						<div class="flex justify-between gap-3">
							<span class="text-black/70">Current usage</span>
							<span class={`font-mono font-bold ${hostInfo.cpu_usage_percent > 80 ? 'text-red-500' : 'text-black'}`}>{hostInfo.cpu_usage_percent}%</span>
						</div>
					</div>
				</div>
				<div class="flex items-center justify-between gap-3 border-b border-black/5 pb-2">
					<dt class="font-medium text-black/70">Limit status</dt>
					<dd class="m-0">
						<span class={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${
							cpuUnthrottled ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
						}`}>{cpuUnthrottled ? 'UNLIMITED' : 'LIMITED'}</span>
					</dd>
				</div>
				<div class="flex justify-between gap-3 border-b border-black/5 pb-2"><dt class="font-medium text-black/70">cpu.weight</dt><dd class="m-0 font-mono font-bold text-black tabular-nums">{runtime?.cgroup.cpu_weight || '...'}</dd></div>
				<div class="flex justify-between gap-3 border-b border-black/5 pb-2">
					<dt class="font-medium text-black/70">cpu.max</dt>
					<dd class="m-0 font-mono font-bold text-black tabular-nums">{runtime?.cgroup.cpu_max || '...'}</dd>
				</div>
				<div class="flex justify-between gap-3">
					<dt class="font-medium text-black/70">Active burners</dt>
					<dd class={`m-0 font-mono font-bold tabular-nums ${(runtime?.cgroup.active_cpu_burners ?? 0) > 0 ? 'text-red-500' : 'text-black'}`}>{runtime?.cgroup.active_cpu_burners ?? 0}</dd>
				</div>
			</dl>
		</article>

		<!-- Card 4: Namespace Reality -->
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
