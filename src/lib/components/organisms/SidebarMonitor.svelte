<script lang="ts">
	import { onMount } from 'svelte';
	import { Cpu, Hash, MemoryStick, ShieldAlert, ShieldCheck } from '@lucide/svelte';
	import type { RuntimeEvidence } from '$lib/types/lab';

	type Props = {
		runtime?: RuntimeEvidence;
		connected: boolean;
		lastUpdated: string;
		onClose?: () => void;
	};

	let { runtime, connected, lastUpdated, onClose }: Props = $props();
	type HostInfo = {
		cpu_cores: number;
		cpu_usage_percent: number;
		memory_total_gb: number;
		memory_available_gb: number;
		memory_total_mib?: number;
		memory_available_mib?: number;
	};

	let hostInfo = $state<HostInfo>({ cpu_cores: 0, cpu_usage_percent: 0, memory_total_gb: 0, memory_available_gb: 0 });

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
		const total = hostInfo.memory_total_mib || hostInfo.memory_total_gb * 1024;
		const available = hostInfo.memory_available_mib || hostInfo.memory_available_gb * 1024;
		if (!total) return 0;
		return Math.min(100, Math.round(((total - available) / total) * 100));
	}

	function formatHostMemory(mib?: number, gb?: number): string {
		if (mib && mib > 0) return `${mib} MiB`;
		if (gb && gb > 0) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GiB`;
		return '—';
	}

	function usernsState(): { label: string; headline: string; detail: string; tone: string; headlineTone: string; safe: boolean } {
		const uid = firstLine(runtime?.uid_map);
		if (/^0\s+0\s+/.test(uid)) {
			return {
				label: 'danger',
				headline: 'root = host root',
				detail: 'UID 0 inside dokuru-lab is UID 0 on the host',
				tone: 'bg-commerce/15 text-commerce',
				headlineTone: 'text-commerce',
				safe: false
			};
		}
		if (/^0\s+(?!0\b)\d{4,}/.test(uid)) {
			return {
				label: 'isolated',
				headline: 'root is remapped',
				detail: 'UID 0 inside dokuru-lab becomes an unprivileged host UID',
				tone: 'bg-emerald-400/15 text-emerald-400',
				headlineTone: 'text-emerald-400',
				safe: true
			};
		}
		return {
			label: 'waiting',
			headline: 'waiting for proof',
			detail: 'root mapping has not arrived yet',
			tone: 'bg-white/10 text-white/45',
			headlineTone: 'text-white/55',
			safe: false
		};
	}

	const pidPct = $derived(percent(runtime?.cgroup.pids_current, runtime?.cgroup.pids_max));
	const memPct = $derived(percent(runtime?.cgroup.memory_current, runtime?.cgroup.memory_max));
	const hostCpuPct = $derived(Math.max(0, Math.min(100, Math.round(hostInfo.cpu_usage_percent || 0))));
	const hostMemPct = $derived(hostMemoryUsedPercent());
	const userns = $derived(usernsState());
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
				<span class="font-mono text-[10px] uppercase tracking-[0.08em] text-white/50">System CPU</span>
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
				<span class="font-mono text-[10px] text-white/35">dokuru-lab cpu.max</span>
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
				{hostInfo.memory_total_gb ? `${hostMemPct}% kernel` : '—'}
			</span>
		</div>
		<div class="h-1 overflow-hidden rounded-full bg-white/10">
			<div class="h-full rounded-full bg-playstation-cyan transition-all duration-500" style={`width: ${hostMemPct}%`}></div>
		</div>
		<div class="mt-2 grid gap-1.5">
			<div class="flex justify-between gap-2">
				<span class="font-mono text-[10px] text-white/35">kernel avail / total</span>
				<span class="font-mono text-[10px] text-white/70 tabular-nums">{formatHostMemory(hostInfo.memory_available_mib, hostInfo.memory_available_gb)} / {formatHostMemory(hostInfo.memory_total_mib, hostInfo.memory_total_gb)}</span>
			</div>
			<div class="flex justify-between gap-2">
				<span class="font-mono text-[10px] text-white/35">dokuru-lab used</span>
				<span class="font-mono text-[10px] text-white/70 tabular-nums">{formatBytes(runtime?.cgroup.memory_current)}</span>
			</div>
			<div class="flex justify-between gap-2">
				<span class="font-mono text-[10px] text-white/35">dokuru-lab limit</span>
				<span class="font-mono text-[10px] text-white/70 tabular-nums">{formatBytes(runtime?.cgroup.memory_max)}</span>
			</div>
		</div>
	</div>

	<!-- Root mapping evidence row -->
	<div class="rounded-xl bg-white/[0.04] px-4 py-3">
		<div class="mb-3 flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<span class="grid h-6 w-6 place-items-center rounded-md bg-[#9ad7ff]/15 text-[#9ad7ff]" aria-hidden="true">
					{#if userns.safe}
						<ShieldCheck size={12} strokeWidth={1.5} />
					{:else}
						<ShieldAlert size={12} strokeWidth={1.5} />
					{/if}
				</span>
				<span class="font-mono text-[10px] uppercase tracking-[0.08em] text-white/50">Host-root risk</span>
			</div>
			<span class={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] ${userns.tone}`}>{userns.label}</span>
		</div>
		<p class={`m-0 mb-1 text-[13px] font-semibold ${userns.headlineTone}`}>{userns.headline}</p>
		<p class="m-0 mb-3 text-[11px] leading-snug text-white/42">{userns.detail}</p>
		<dl class="grid gap-1.5">
			<div class="flex justify-between gap-2">
				<dt class="font-mono text-[10px] text-white/35">UID 0 map</dt>
				<dd class="m-0 max-w-[55%] truncate font-mono text-[10px] text-white/70 tabular-nums text-right">{firstLine(runtime?.uid_map)}</dd>
			</div>
			<div class="flex justify-between gap-2">
				<dt class="font-mono text-[10px] text-white/35">PID namespace</dt>
				<dd class="m-0 max-w-[55%] truncate font-mono text-[10px] text-white/70 tabular-nums text-right">{runtime?.pid_namespace || '—'}</dd>
			</div>
			<div class="flex justify-between gap-2">
				<dt class="font-mono text-[10px] text-white/35">processes visible</dt>
				<dd class="m-0 font-mono text-[10px] text-white/70 tabular-nums">{runtime?.processes.process_count || '—'} in lab</dd>
			</div>
		</dl>
	</div>
</div>
