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

	<div class="grid gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
		<article class="grid gap-2.5 rounded-[12px] border border-divider p-3.5 transition-colors hover:border-black/12">
			<div class="flex items-center gap-2 text-body-gray">
				<Hash size={13} strokeWidth={2.4} class="text-playstation-blue" />
				<span class="text-[11px] font-mono tracking-[0.04em] text-body-gray">processes</span>
			</div>
			<Field id="pid-count" label="PIDs" type="number" min={1} max={500} value={pidCount} oninput={(value) => onPidCountChange(Number(value))} />
			<Button onclick={onPidBomb} disabled={Boolean(running)}>Run PID bomb</Button>
		</article>
		<article class="grid gap-2.5 rounded-[12px] border border-divider p-3.5 transition-colors hover:border-black/12">
			<div class="flex items-center gap-2 text-body-gray">
				<MemoryStick size={13} strokeWidth={2.2} class="text-[#0e7fa8]" />
				<span class="text-[11px] font-mono tracking-[0.04em] text-body-gray">allocation</span>
			</div>
			<Field id="memory-mb" label="Memory MB" type="number" min={1} max={1024} value={memoryMb} oninput={(value) => onMemoryChange(Number(value))} />
			<Button onclick={onMemoryBomb} disabled={Boolean(running)}>Allocate</Button>
		</article>
		<article class="grid gap-2.5 rounded-[12px] border border-divider p-3.5 transition-colors hover:border-black/12">
			<div class="flex items-center gap-2 text-body-gray">
				<Cpu size={13} strokeWidth={2.2} class="text-commerce" />
				<span class="text-[11px] font-mono tracking-[0.04em] text-body-gray">scheduler</span>
			</div>
			<Field id="cpu-seconds" label="CPU seconds" type="number" min={1} max={30} value={cpuSeconds} oninput={(value) => onCpuChange(Number(value))} />
			<Button onclick={onCpuBurn} disabled={Boolean(running)}>Burn CPU</Button>
		</article>
		<article class="grid content-between gap-2.5 rounded-[12px] border border-divider p-3.5 transition-colors hover:border-black/12">
			<div>
				<div class="mb-1.5 flex items-center gap-2">
					<Trash2 size={13} strokeWidth={2.2} class="text-commerce" />
					<span class="text-[13px] font-medium text-ink">Cleanup</span>
				</div>
				<p class="m-0 text-[12.5px] leading-snug text-body-gray">Kill sleeper processes after PID tests.</p>
			</div>
			<Button variant="commerce" onclick={onCleanup} disabled={Boolean(running)}>Cleanup</Button>
		</article>
	</div>
</Panel>
