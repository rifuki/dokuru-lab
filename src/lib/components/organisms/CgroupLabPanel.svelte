<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';
	import Field from '$lib/components/atoms/Field.svelte';
	import OutputPanel from '$lib/components/molecules/OutputPanel.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';

	type Props = {
		pidCount: number;
		memoryMb: number;
		cpuSeconds: number;
		output: string;
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
		output,
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

<Panel id="cgroup" title="Cgroup pressure" subtitle="Rules 5.11, 5.12, 5.29" class="lg:col-span-8">
	<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
		<div class="grid gap-2.5 rounded-xl border border-divider p-3.5">
			<Field id="pid-count" label="PIDs" type="number" min={1} max={500} value={pidCount} oninput={(value) => onPidCountChange(Number(value))} />
			<Button onclick={onPidBomb} disabled={running === 'pid'}>Run PID bomb</Button>
		</div>
		<div class="grid gap-2.5 rounded-xl border border-divider p-3.5">
			<Field id="memory-mb" label="Memory MB" type="number" min={1} max={1024} value={memoryMb} oninput={(value) => onMemoryChange(Number(value))} />
			<Button onclick={onMemoryBomb} disabled={running === 'memory'}>Allocate</Button>
		</div>
		<div class="grid gap-2.5 rounded-xl border border-divider p-3.5">
			<Field id="cpu-seconds" label="CPU seconds" type="number" min={1} max={30} value={cpuSeconds} oninput={(value) => onCpuChange(Number(value))} />
			<Button onclick={onCpuBurn} disabled={running === 'cpu'}>Burn CPU</Button>
		</div>
		<div class="grid content-between gap-2.5 rounded-xl border border-divider p-3.5">
			<div>
				<span class="mb-1.5 block text-sm font-bold text-ink">Cleanup</span>
				<p class="m-0 text-[13px] leading-snug text-body-gray">Kill sleeper processes after PID tests.</p>
			</div>
			<Button variant="commerce" onclick={onCleanup} disabled={running === 'cleanup'}>Cleanup</Button>
		</div>
	</div>

	<OutputPanel content={output} />
</Panel>
