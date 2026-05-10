<script lang="ts">
	import { Cpu, Hash, MemoryStick, Trash2 } from '@lucide/svelte';
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
	<div class="grid gap-4 @4xl/main:grid-cols-[1fr_auto]">
		<!-- Three pressure controls -->
		<div class="grid gap-3 @xl/main:grid-cols-3">
			<article class="grid gap-3 rounded-2xl border border-transparent bg-white p-4 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
				<div class="flex items-center gap-2.5 border-b border-black/5 pb-2.5">
					<span class="grid h-8 w-8 place-items-center rounded-lg bg-playstation-blue/10 text-playstation-blue" aria-hidden="true">
						<Hash size={15} strokeWidth={1.5} />
					</span>
					<span class="text-[11px] font-mono uppercase tracking-[0.1em] text-body-gray">Processes</span>
				</div>
				<Field id="pid-count" label="PIDs" type="number" min={1} max={500} value={pidCount} oninput={(value) => onPidCountChange(Number(value))} />
				<Button onclick={onPidBomb} disabled={Boolean(running)}>Run PID bomb</Button>
			</article>

			<article class="grid gap-3 rounded-2xl border border-transparent bg-white p-4 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
				<div class="flex items-center gap-2.5 border-b border-black/5 pb-2.5">
					<span class="grid h-8 w-8 place-items-center rounded-lg bg-playstation-cyan/15 text-[#0e7fa8]" aria-hidden="true">
						<MemoryStick size={15} strokeWidth={1.5} />
					</span>
					<span class="text-[11px] font-mono uppercase tracking-[0.1em] text-body-gray">Allocation</span>
				</div>
				<Field id="memory-mb" label="Memory MB" type="number" min={1} max={3500} value={memoryMb} oninput={(value) => onMemoryChange(Number(value))} />
				<p class="m-0 text-[12.5px] leading-relaxed text-body-gray">Starts a child process that holds memory until Cleanup or Stop payload.</p>
				<Button onclick={onMemoryBomb} disabled={Boolean(running)}>Start memory pressure</Button>
			</article>

			<article class="grid gap-3 rounded-2xl border border-transparent bg-white p-4 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
				<div class="flex items-center gap-2.5 border-b border-black/5 pb-2.5">
					<span class="grid h-8 w-8 place-items-center rounded-lg bg-commerce/10 text-commerce" aria-hidden="true">
						<Cpu size={15} strokeWidth={1.5} />
					</span>
					<span class="text-[11px] font-mono uppercase tracking-[0.1em] text-body-gray">CPU pressure</span>
				</div>
				<Field id="cpu-seconds" label="CPU burn seconds" type="number" min={1} max={30} value={cpuSeconds} oninput={(value) => onCpuChange(Number(value))} />
				<Button onclick={onCpuBurn} disabled={Boolean(running)}>Burn CPU</Button>
			</article>
		</div>

		<!-- Cleanup card, narrower on wide screens -->
		<article class="flex flex-col justify-between gap-4 rounded-2xl border border-transparent bg-white p-4 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5 @4xl/main:w-48">
			<div>
				<div class="mb-3 flex items-center gap-2.5 border-b border-black/5 pb-2.5">
					<span class="grid h-8 w-8 place-items-center rounded-lg bg-commerce/10 text-commerce" aria-hidden="true">
						<Trash2 size={15} strokeWidth={1.5} />
					</span>
					<span class="text-[13px] font-semibold tracking-wide text-ink">Cleanup</span>
				</div>
				<p class="m-0 text-[12.5px] leading-relaxed text-body-gray">Kill sleeper, CPU, and memory pressure processes to reset the environment.</p>
			</div>
			<Button variant="commerce" onclick={onCleanup} disabled={Boolean(running)}>Cleanup</Button>
		</article>
	</div>
</Panel>
