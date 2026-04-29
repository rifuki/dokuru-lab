<script lang="ts">
	import { Cpu, Hash, Info, MemoryStick, Trash2 } from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import Field from '$lib/components/atoms/Field.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { LabResponse } from '$lib/types/lab';

	type Props = {
		pidCount: number;
		memoryMb: number;
		cpuSeconds: number;
		result: LabResponse | null;
		running: string;
		onPidCountChange: (value: number) => void;
		onMemoryChange: (value: number) => void;
		onCpuChange: (value: number) => void;
		onPidBomb: () => void | Promise<void>;
		onMemoryBomb: () => void | Promise<void>;
		onCpuBurn: () => void | Promise<void>;
		onCleanup: () => void | Promise<void>;
	};

	let {
		pidCount,
		memoryMb,
		cpuSeconds,
		result,
		running,
		onPidCountChange,
		onMemoryChange,
		onCpuChange,
		onPidBomb,
		onMemoryBomb,
		onCpuBurn,
		onCleanup
	}: Props = $props();
</script>

<Panel title="Cgroup pressure" subtitle="Rules 5.11, 5.12, 5.29">
	<div class="mb-4 flex gap-3 rounded-[12px] border border-playstation-blue/15 bg-[#eef7ff] p-4">
		<span class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-playstation-blue/15 text-playstation-blue" aria-hidden="true">
			<Info size={13} strokeWidth={2.2} />
		</span>
		<div class="min-w-0">
			<strong class="block text-[13px] font-medium text-ink">How to prove PIDs</strong>
			<p class="m-0 mt-1.5 text-[13px] leading-relaxed text-body-gray">
				Watch <code>pids.current</code> in the live monitor, run the PID bomb, then compare before/after Dokuru. Before hardening it can spawn many sleepers; after rule 5.29 is fixed, <code>pids.max</code> is lower and spawning is capped or fails earlier.
			</p>
			{#if result?.scenario === 'PIDs cgroup pressure'}
				<p class="m-0 mt-2 text-[13px] text-ink">
					Last PID run requested <strong>{String(result.requested)}</strong> processes. Watch the live terminal for each spawned PID and the monitor for <code>pids.current</code>.
				</p>
			{/if}
		</div>
	</div>

	<div class="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
		<article class="grid gap-4 rounded-2xl border border-transparent bg-white p-5 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_15px_rgba(0,0,0,0.08)] hover:ring-black/10">
			<div class="flex items-center gap-3 border-b border-black/5 pb-2">
				<span class="grid h-8 w-8 place-items-center rounded-lg bg-playstation-blue/10 text-playstation-blue" aria-hidden="true">
					<Hash size={16} strokeWidth={1.5} />
				</span>
				<span class="text-[12px] font-mono uppercase tracking-[0.1em] text-body-gray">processes</span>
			</div>
			<Field id="pid-count" label="PIDs" type="number" min={1} max={500} value={pidCount} oninput={(value) => onPidCountChange(Number(value))} />
			<Button onclick={onPidBomb} disabled={Boolean(running)}>Run PID bomb</Button>
		</article>
		<article class="grid gap-4 rounded-2xl border border-transparent bg-white p-5 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_15px_rgba(0,0,0,0.08)] hover:ring-black/10">
			<div class="flex items-center gap-3 border-b border-black/5 pb-2">
				<span class="grid h-8 w-8 place-items-center rounded-lg bg-playstation-cyan/15 text-[#0e7fa8]" aria-hidden="true">
					<MemoryStick size={16} strokeWidth={1.5} />
				</span>
				<span class="text-[12px] font-mono uppercase tracking-[0.1em] text-body-gray">allocation</span>
			</div>
			<Field id="memory-mb" label="Memory MB" type="number" min={1} max={1024} value={memoryMb} oninput={(value) => onMemoryChange(Number(value))} />
			<Button onclick={onMemoryBomb} disabled={Boolean(running)}>Allocate</Button>
		</article>
		<article class="grid gap-4 rounded-2xl border border-transparent bg-white p-5 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_15px_rgba(0,0,0,0.08)] hover:ring-black/10">
			<div class="flex items-center gap-3 border-b border-black/5 pb-2">
				<span class="grid h-8 w-8 place-items-center rounded-lg bg-commerce/10 text-commerce" aria-hidden="true">
					<Cpu size={16} strokeWidth={1.5} />
				</span>
				<span class="text-[12px] font-mono uppercase tracking-[0.1em] text-body-gray">scheduler</span>
			</div>
			<Field id="cpu-seconds" label="CPU seconds" type="number" min={1} max={30} value={cpuSeconds} oninput={(value) => onCpuChange(Number(value))} />
			<Button onclick={onCpuBurn} disabled={Boolean(running)}>Burn CPU</Button>
		</article>
		<article class="grid content-between gap-4 rounded-2xl border border-transparent bg-white p-5 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_15px_rgba(0,0,0,0.08)] hover:ring-black/10">
			<div>
				<div class="mb-3 flex items-center gap-3 border-b border-black/5 pb-2">
					<span class="grid h-8 w-8 place-items-center rounded-lg bg-commerce/10 text-commerce" aria-hidden="true">
						<Trash2 size={16} strokeWidth={1.5} />
					</span>
					<span class="text-[14px] font-semibold tracking-wide text-ink">Cleanup</span>
				</div>
				<p class="m-0 text-[13px] leading-relaxed text-body-gray">Kill sleeper processes after PID tests to reset the environment.</p>
			</div>
			<Button variant="commerce" onclick={onCleanup} disabled={Boolean(running)}>Cleanup</Button>
		</article>
	</div>
</Panel>
