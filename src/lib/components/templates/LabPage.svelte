<script lang="ts">
	import { onMount } from 'svelte';
	import CgroupLabPanel from '$lib/components/organisms/CgroupLabPanel.svelte';
	import HeroSection from '$lib/components/organisms/HeroSection.svelte';
	import LiveMonitorPanel from '$lib/components/organisms/LiveMonitorPanel.svelte';
	import Masthead from '$lib/components/organisms/Masthead.svelte';
	import NamespaceLabPanel from '$lib/components/organisms/NamespaceLabPanel.svelte';
	import ProofChecklistPanel from '$lib/components/organisms/ProofChecklistPanel.svelte';
	import RuntimeEvidencePanel from '$lib/components/organisms/RuntimeEvidencePanel.svelte';
	import type { CommandPreset, LabResponse, RuntimeEvidence } from '$lib/types/lab';

	let command = $state('id; cat /proc/self/uid_map; cat /proc/self/gid_map');
	let pidCount = $state(120);
	let memoryMb = $state(128);
	let cpuSeconds = $state(5);
	let running = $state('');
	let evidenceData = $state<LabResponse | null>(null);
	let namespaceOutput = $state('Choose a namespace payload, then run it.');
	let cgroupOutput = $state('Run a pressure test to collect cgroup evidence.');
	let cgroupResult = $state<LabResponse | null>(null);
	let lastUpdated = $state('');

	const presets: CommandPreset[] = [
		{ label: 'UID map', command: 'id; cat /proc/self/uid_map; cat /proc/self/gid_map' },
		{ label: 'PID view', command: 'ps -eo pid,ppid,user,comm | head -40' },
		{
			label: 'Namespace links',
			command: 'readlink /proc/self/ns/user; readlink /proc/self/ns/pid; readlink /proc/1/ns/pid'
		}
	];

	const runtime = $derived(evidenceData?.runtime as RuntimeEvidence | undefined);

	onMount(() => {
		void refreshEvidence(true);
		const interval = window.setInterval(() => void refreshEvidence(false), 1200);
		return () => window.clearInterval(interval);
	});

	async function refreshEvidence(showLoading = true) {
		if (showLoading) running = 'health';
		const result = await requestJson('/api/evidence');
		evidenceData = result;
		lastUpdated = new Date().toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		if (showLoading) running = '';
	}

	async function runProbe() {
		running = 'probe';
		const result = await requestJson('/api/probe', { method: 'POST' });
		namespaceOutput = pretty(result);
		if (result.runtime) evidenceData = { ok: result.ok, runtime: result.runtime };
		running = '';
	}

	async function runExec() {
		running = 'exec';
		namespaceOutput = 'Running command in the container...';
		const result = await postJson('/api/exec', { command });
		namespaceOutput = pretty(result);
		if (result.runtime) evidenceData = { ok: result.ok, runtime: result.runtime };
		running = '';
	}

	async function runPidBomb() {
		running = 'pid';
		cgroupOutput = 'Spawning sleeper processes...';
		cgroupResult = await postJson('/api/pid-bomb', { count: pidCount });
		cgroupOutput = pretty(cgroupResult);
		await refreshEvidence(false);
		running = '';
	}

	async function runMemoryBomb() {
		running = 'memory';
		cgroupOutput = 'Allocating memory and holding it in the server process...';
		cgroupResult = await postJson('/api/memory-bomb', { mb: memoryMb });
		cgroupOutput = pretty(cgroupResult);
		await refreshEvidence(false);
		running = '';
	}

	async function runCpuBurn() {
		running = 'cpu';
		cgroupOutput = 'Starting a short CPU burner process...';
		cgroupResult = await postJson('/api/cpu-burn', { seconds: cpuSeconds });
		cgroupOutput = pretty(cgroupResult);
		await refreshEvidence(false);
		running = '';
	}

	async function cleanupPidBomb() {
		running = 'cleanup';
		cgroupOutput = 'Cleaning up sleeper, CPU, and held-memory pressure...';
		cgroupResult = await requestJson('/api/cleanup', { method: 'POST' });
		cgroupOutput = pretty(cgroupResult);
		await refreshEvidence(false);
		running = '';
	}

	async function requestJson(path: string, options: RequestInit = {}): Promise<LabResponse> {
		try {
			const response = await fetch(path, options);
			const text = await response.text();
			const parsed = JSON.parse(text) as LabResponse;
			return { http_status: response.status, ...parsed };
		} catch (error) {
			return { ok: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	function postJson(path: string, values: Record<string, unknown>): Promise<LabResponse> {
		return requestJson(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(values)
		});
	}

	function pretty(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}
</script>

<Masthead onRefresh={() => refreshEvidence(true)} running={running === 'health'} />

<main>
	<HeroSection runtime={runtime} onProbe={runProbe} onRunCommand={runExec} {running} />

	<section class="bg-white px-4 py-14 md:px-16 lg:px-24 lg:py-[72px]">
		<div class="mx-auto mb-5 flex max-w-[1540px] flex-col justify-between gap-4 lg:flex-row lg:items-end">
			<div>
				<p class="m-0 mb-2 text-sm font-bold tracking-[0.12em] text-playstation-blue uppercase">Demo board</p>
				<h2 class="m-0 text-[clamp(28px,4vw,42px)] leading-tight font-light text-black">Before / after evidence</h2>
			</div>
			<p class="m-0 max-w-2xl text-[16px] leading-relaxed text-body-gray">
				Start with the live monitor, run one proof at a time, then compare the same cards after Dokuru fixes namespace and cgroup rules.
			</p>
		</div>

		<div class="mx-auto grid max-w-[1540px] grid-cols-1 gap-4 lg:grid-cols-12">
			<LiveMonitorPanel runtime={runtime} {lastUpdated} />

			<RuntimeEvidencePanel
				runtime={runtime}
				ok={Boolean(evidenceData?.ok)}
				onRefresh={() => refreshEvidence(true)}
				onProbe={runProbe}
				{running}
			/>

			<NamespaceLabPanel
				{command}
				{presets}
				output={namespaceOutput}
				{running}
				onCommandChange={(value) => (command = value)}
				onRun={runExec}
			/>

			<CgroupLabPanel
				{pidCount}
				{memoryMb}
				{cpuSeconds}
				output={cgroupOutput}
				result={cgroupResult}
				{running}
				onPidCountChange={(value) => (pidCount = value)}
				onMemoryChange={(value) => (memoryMb = value)}
				onCpuChange={(value) => (cpuSeconds = value)}
				onPidBomb={runPidBomb}
				onMemoryBomb={runMemoryBomb}
				onCpuBurn={runCpuBurn}
				onCleanup={cleanupPidBomb}
			/>

			<ProofChecklistPanel />
		</div>
	</section>
</main>

<footer class="flex flex-col justify-between gap-3 bg-playstation-blue px-4 py-6 text-sm text-white md:px-16 lg:flex-row lg:px-24">
	<strong>Dokuru Namespace Cgroup Lab</strong>
	<span class="max-w-3xl">Run only on a disposable lab host. Endpoints intentionally expose shell execution and resource pressure.</span>
</footer>
