<script lang="ts">
	import { AlertTriangle, BarChart3, Radio, TrendingUp } from '@lucide/svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { CustomerSample } from '$lib/types/lab';

	type Props = {
		samples: CustomerSample[];
		connected: boolean;
	};

	let { samples, connected }: Props = $props();

	const latest = $derived(samples.at(-1));
	const recent = $derived(samples.slice(-28));
	const failures = $derived(recent.filter((sample) => !sample.ok).length);
	const avgLatency = $derived(averageLatency(recent));

	function averageLatency(values: CustomerSample[]): string {
		const successful = values.filter((sample) => sample.ok && Number.isFinite(sample.latency_ms));
		if (successful.length === 0) return '...';
		const total = successful.reduce((sum, sample) => sum + sample.latency_ms, 0);
		return `${Math.round(total / successful.length)}ms`;
	}

	function latencyLabel(sample?: CustomerSample): string {
		if (!sample) return 'waiting';
		return sample.ok ? `${sample.latency_ms}ms` : 'timeout';
	}

	function isSlow(sample?: CustomerSample): boolean {
		return Boolean(sample?.ok && sample.latency_ms >= 750);
	}

	function isDegraded(sample?: CustomerSample): boolean {
		return Boolean(sample?.ok && sample.latency_ms >= 250 && sample.latency_ms < 750);
	}

	function statusClass(sample?: CustomerSample): string {
		if (!sample) return 'bg-ice text-body-gray';
		if (isSlow(sample)) return 'bg-[#fff0ed] text-commerce';
		if (isDegraded(sample)) return 'bg-[#fff7db] text-[#8a5a00]';
		return sample.ok ? 'bg-[#e8f8ee] text-[#176b34]' : 'bg-[#fff0ed] text-commerce';
	}

	function statusLabel(sample?: CustomerSample): string {
		if (!sample) return 'no data';
		if (!sample.ok) return 'down';
		if (isSlow(sample)) return 'slow';
		if (isDegraded(sample)) return 'degraded';
		return `http ${sample.status}`;
	}

	function barClass(sample: CustomerSample): string {
		if (!sample.ok || isSlow(sample)) return 'bg-commerce';
		if (isDegraded(sample)) return 'bg-[#ffb020]';
		return 'bg-playstation-cyan';
	}

	function barHeight(sample: CustomerSample): number {
		if (!sample.ok) return 100;
		return Math.max(10, Math.min(100, Math.round((sample.latency_ms / 1000) * 100)));
	}
</script>

<Panel
	title="Customer Live View"
	subtitle={connected ? 'Protected Checkout API live' : 'waiting for stream'}
	class="@4xl/main:col-span-5"
>
	<div class="rounded-[19px] border border-white/8 bg-[#061826] p-4 text-white">
		<div class="mb-4 flex items-start justify-between gap-4">
			<div>
				<p class="m-0 inline-flex items-center gap-2 text-[12.5px] font-medium text-[#9ad7ff]">
					<span class="inline-block h-1 w-1 rounded-full bg-[#9ad7ff]" aria-hidden="true"></span>
					Real customer path
				</p>
				<strong class="mt-1 block text-[34px] leading-none font-light tabular-nums">{latencyLabel(latest)}</strong>
			</div>
			<span class={`rounded-full px-3 py-1 text-[11.5px] font-medium ${statusClass(latest)}`}>
				{statusLabel(latest)}
			</span>
		</div>

		<div class="flex h-28 items-end gap-1 rounded-xl bg-black/30 p-2" aria-label="customer latency bars">
			{#if recent.length === 0}
				<div class="w-full text-center text-sm text-white/50">waiting for latency probe...</div>
			{/if}
			{#each recent as sample}
				<div
					class={`min-w-1 flex-1 rounded-t ${barClass(sample)}`}
					style={`height: ${barHeight(sample)}%`}
					title={sample.ok ? `${sample.latency_ms}ms` : sample.error || 'request failed'}
				></div>
			{/each}
		</div>

		<div class="mt-4 grid grid-cols-3 gap-2 text-[12px]">
			<div class="rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
				<div class="flex items-center gap-2 text-white/60">
					<TrendingUp size={14} strokeWidth={1.5} />
					<span>Average</span>
				</div>
				<strong class="mt-2 block font-mono text-[14px] text-white tabular-nums">{avgLatency}</strong>
			</div>
			<div class="rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
				<div class="flex items-center gap-2 text-white/60">
					<AlertTriangle size={14} strokeWidth={1.5} />
					<span>Failures</span>
				</div>
				<strong class="mt-2 block font-mono text-[14px] text-white tabular-nums">{failures}</strong>
			</div>
			<div class="rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
				<div class="flex items-center gap-2 text-white/60">
					<BarChart3 size={14} strokeWidth={1.5} />
					<span>Samples</span>
				</div>
				<strong class="mt-2 block font-mono text-[14px] text-white tabular-nums">{recent.length}</strong>
			</div>
		</div>

		<div class="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-4 text-[12px] text-white/70">
			<Radio size={14} strokeWidth={1.5} class="shrink-0 text-white/50" />
			<span class="min-w-0 flex-1 truncate">
				Source: <strong class="font-mono text-white">{latest?.source || 'direct-probe'}</strong>
				{#if latest?.observed_at}
					<span class="ml-2">observed {latest.observed_at}</span>
				{/if}
			</span>
		</div>
	</div>

	<p class="m-0 mt-3 text-sm leading-relaxed text-body-gray">
		Latency is sampled by the <code>latency-probe</code> sidecar hitting the Protected Checkout API (<code>checkout-api</code>). Even when the attacker lab steals CPU or memory, this signal originates from a separate container so blast radius is observable end-to-end.
	</p>
</Panel>
