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

<section class="grid min-h-[470px] grid-cols-1 items-stretch gap-8 bg-black px-4 py-14 text-white md:px-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-24 lg:py-20">
	<div class="animate-rise-in self-center">
		<p class="mb-3.5 text-sm font-medium text-[#cccccc]">SvelteKit server-side vulnerability lab</p>
		<h1 class="mb-4 max-w-3xl text-[clamp(38px,5.2vw,54px)] leading-[1.08] font-light tracking-[-0.1px]">
			Same bug, smaller blast radius.
		</h1>
		<p class="mb-6 max-w-3xl text-lg leading-relaxed text-[#e5e5e5]">
			Use the same browser-triggered payloads before and after Dokuru hardening. The app remains intentionally vulnerable, but namespace and cgroup boundaries reduce the impact.
		</p>
		<div class="flex flex-wrap items-center gap-2.5">
			<Button onclick={onProbe} disabled={running === 'probe'}>Run recovery probe</Button>
			<Button variant="secondary" onclick={onRunCommand} disabled={running === 'exec'}>Run selected command</Button>
		</div>
	</div>

	<div class="grid content-center gap-3 sm:grid-cols-2">
		<MetricTile dark label="UID map" value={runtime?.uid_map || 'loading'} />
		<MetricTile dark label="PID namespace" value={runtime?.pid_namespace || 'loading'} />
		<MetricTile dark label="PIDs max" value={runtime?.cgroup.pids_max || 'loading'} />
		<MetricTile dark label="Memory max" value={runtime?.cgroup.memory_max || 'loading'} />
	</div>
</section>
