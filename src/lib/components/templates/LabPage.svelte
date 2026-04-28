<script lang="ts">
	import { onMount } from 'svelte';
	import CgroupLabPanel from '$lib/components/organisms/CgroupLabPanel.svelte';
	import HeroSection from '$lib/components/organisms/HeroSection.svelte';
	import Masthead from '$lib/components/organisms/Masthead.svelte';
	import NamespaceLabPanel from '$lib/components/organisms/NamespaceLabPanel.svelte';
	import ProofChecklistPanel from '$lib/components/organisms/ProofChecklistPanel.svelte';
	import RuntimeEvidencePanel from '$lib/components/organisms/RuntimeEvidencePanel.svelte';
	import type { CommandPreset, LabResponse, RuntimeEvidence } from '$lib/types/lab';

	let command = $state('id; cat /proc/self/uid_map; cat /proc/self/gid_map');
	let url = $state('http://127.0.0.1:9999/');
	let pidCount = $state(120);
	let memoryMb = $state(128);
	let cpuSeconds = $state(5);
	let running = $state('');
	let healthData = $state<LabResponse | null>(null);
	let namespaceOutput = $state('Choose a namespace payload, then run it.');
	let cgroupOutput = $state('Run a pressure test to collect cgroup evidence.');
	let probeOutput = $state('Run the recovery probe after hardening.');

	const presets: CommandPreset[] = [
		{ label: 'UID map', command: 'id; cat /proc/self/uid_map; cat /proc/self/gid_map' },
		{ label: 'PID view', command: 'ps -eo pid,ppid,user,comm | head -40' },
		{
			label: 'Namespace links',
			command: 'readlink /proc/self/ns/user; readlink /proc/self/ns/pid; readlink /proc/1/ns/pid'
		}
	];

	const runtime = $derived(healthData?.runtime as RuntimeEvidence | undefined);

	onMount(() => {
		void refreshHealth();
	});

	async function refreshHealth() {
		running = 'health';
		healthData = await requestJson('/api/health');
		probeOutput = pretty(healthData);
		running = '';
	}

	async function runProbe() {
		running = 'probe';
		probeOutput = 'Running recovery probe...';
		const result = await requestJson('/api/probe', { method: 'POST' });
		probeOutput = pretty(result);
		if (result.runtime) healthData = { ok: result.ok, runtime: result.runtime };
		running = '';
	}

	async function runExec() {
		running = 'exec';
		namespaceOutput = 'Running command in the container...';
		const result = await postJson('/api/exec', { command });
		namespaceOutput = pretty(result);
		if (result.runtime) healthData = { ok: result.ok, runtime: result.runtime };
		running = '';
	}

	async function runFetch() {
		running = 'fetch';
		namespaceOutput = 'Fetching URL from the server side...';
		const result = await postJson('/api/fetch-url', { url });
		namespaceOutput = pretty(result);
		if (result.runtime) healthData = { ok: result.ok, runtime: result.runtime };
		running = '';
	}

	async function runPidBomb() {
		running = 'pid';
		cgroupOutput = 'Spawning sleeper processes...';
		cgroupOutput = pretty(await postJson('/api/pid-bomb', { count: pidCount }));
		running = '';
	}

	async function runMemoryBomb() {
		running = 'memory';
		cgroupOutput = 'Allocating memory inside the request worker...';
		cgroupOutput = pretty(await postJson('/api/memory-bomb', { mb: memoryMb }));
		running = '';
	}

	async function runCpuBurn() {
		running = 'cpu';
		cgroupOutput = 'Burning CPU inside the request worker...';
		cgroupOutput = pretty(await postJson('/api/cpu-burn', { seconds: cpuSeconds }));
		running = '';
	}

	async function cleanupPidBomb() {
		running = 'cleanup';
		cgroupOutput = 'Cleaning up sleeper processes...';
		cgroupOutput = pretty(await requestJson('/api/cleanup', { method: 'POST' }));
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

<Masthead onRefresh={refreshHealth} running={running === 'health'} />

<main>
	<HeroSection runtime={runtime} onProbe={runProbe} onRunCommand={runExec} {running} />

	<section class="bg-white px-4 py-14 md:px-16 lg:px-24 lg:py-[72px]">
		<div class="mx-auto mb-5 flex max-w-[1540px] flex-col justify-between gap-6 lg:flex-row">
			<h2 class="m-0 text-[clamp(28px,4vw,44px)] leading-tight font-light text-black">Attack controls</h2>
			<p class="m-0 max-w-xl text-[17px] leading-relaxed text-body-gray">
				Use these browser controls during the before/after demo. Outputs stay near the action so screenshots remain clean.
			</p>
		</div>

		<div class="mx-auto grid max-w-[1540px] grid-cols-1 gap-4 lg:grid-cols-12">
			<RuntimeEvidencePanel
				runtime={runtime}
				ok={Boolean(healthData?.ok)}
				output={probeOutput}
				onRefresh={refreshHealth}
				onProbe={runProbe}
				{running}
			/>

			<NamespaceLabPanel
				{url}
				{command}
				{presets}
				output={namespaceOutput}
				{running}
				onUrlChange={(value) => (url = value)}
				onCommandChange={(value) => (command = value)}
				onFetch={runFetch}
				onRun={runExec}
			/>

			<CgroupLabPanel
				{pidCount}
				{memoryMb}
				{cpuSeconds}
				output={cgroupOutput}
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
	<span class="max-w-3xl">Run only on a disposable lab host. Endpoints intentionally expose SSRF, shell execution, and resource pressure.</span>
</footer>
