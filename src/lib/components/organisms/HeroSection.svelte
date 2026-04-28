<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';
	import MetricTile from '$lib/components/atoms/MetricTile.svelte';
	import type { RuntimeEvidence } from '$lib/types/lab';

	type Props = {
		runtime?: RuntimeEvidence;
		onProbe: () => void | Promise<void>;
		onRunCommand: () => void | Promise<void>;
		running: string;
	};

	let { runtime, onProbe, onRunCommand, running }: Props = $props();
</script>

<section class="grid grid-cols-1 items-stretch gap-8 bg-black px-4 py-12 text-white md:px-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-24 lg:py-14">
	<div class="animate-rise-in self-center">
		<p class="mb-3 text-sm font-medium text-[#cccccc]">Container isolation lab</p>
		<h1 class="mb-4 max-w-3xl text-[clamp(34px,4.6vw,52px)] leading-[1.06] font-light tracking-[-0.1px]">
			Show the exploit, then show the boundary.
		</h1>
		<p class="mb-6 max-w-3xl text-lg leading-relaxed text-[#e5e5e5]">
			The app stays intentionally vulnerable. Dokuru should change what the container can see and how many resources it can consume.
		</p>
		<div class="flex flex-wrap items-center gap-2.5">
			<Button onclick={onProbe} disabled={Boolean(running)}>Run recovery probe</Button>
			<Button variant="secondary" onclick={onRunCommand} disabled={Boolean(running)}>Run selected command</Button>
		</div>
	</div>

	<div class="grid content-center gap-3 sm:grid-cols-2">
		<MetricTile dark label="UID map" value={runtime?.uid_map || 'loading'} />
		<MetricTile dark label="PID namespace" value={runtime?.pid_namespace || 'loading'} />
		<MetricTile dark label="PIDs current / max" value={runtime ? `${runtime.cgroup.pids_current} / ${runtime.cgroup.pids_max}` : 'loading'} />
		<MetricTile dark label="Memory current / max" value={runtime ? `${runtime.cgroup.memory_current} / ${runtime.cgroup.memory_max}` : 'loading'} />
	</div>
</section>
