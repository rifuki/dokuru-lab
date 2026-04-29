<script lang="ts">
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
	<div class="mb-4 rounded-xl border border-playstation-blue/20 bg-[#eef7ff] p-4">
		<strong class="block text-sm text-ink">How to prove PIDs</strong>
		<p class="m-0 mt-2 text-sm leading-relaxed text-body-gray">
			Watch <code>pids.current</code> in the live monitor, run the PID bomb, then compare before/after Dokuru. Before hardening it can spawn many sleepers; after rule 5.29 is fixed, <code>pids.max</code> is lower and spawning is capped or fails earlier.
		</p>
		{#if result?.scenario === 'PIDs cgroup pressure'}
			<p class="m-0 mt-2 text-sm text-ink">
				Last PID run requested <strong>{String(result.requested)}</strong> processes. Watch the live terminal for each spawned PID and the monitor for <code>pids.current</code>.
			</p>
		{/if}
	</div>

	<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
		<div class="grid gap-2.5 rounded-xl border border-divider p-3.5">
			<Field id="pid-count" label="PIDs" type="number" min={1} max={500} value={pidCount} oninput={(value) => onPidCountChange(Number(value))} />
			<Button onclick={onPidBomb} disabled={Boolean(running)}>Run PID bomb</Button>
		</div>
		<div class="grid gap-2.5 rounded-xl border border-divider p-3.5">
			<Field id="memory-mb" label="Memory MB" type="number" min={1} max={1024} value={memoryMb} oninput={(value) => onMemoryChange(Number(value))} />
			<Button onclick={onMemoryBomb} disabled={Boolean(running)}>Allocate</Button>
		</div>
		<div class="grid gap-2.5 rounded-xl border border-divider p-3.5">
			<Field id="cpu-seconds" label="CPU seconds" type="number" min={1} max={30} value={cpuSeconds} oninput={(value) => onCpuChange(Number(value))} />
			<Button onclick={onCpuBurn} disabled={Boolean(running)}>Burn CPU</Button>
		</div>
		<div class="grid content-between gap-2.5 rounded-xl border border-divider p-3.5">
			<div>
				<span class="mb-1.5 block text-sm font-bold text-ink">Cleanup</span>
				<p class="m-0 text-[13px] leading-snug text-body-gray">Kill sleeper processes after PID tests.</p>
			</div>
			<Button variant="commerce" onclick={onCleanup} disabled={Boolean(running)}>Cleanup</Button>
		</div>
	</div>

</Panel>
