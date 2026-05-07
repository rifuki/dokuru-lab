<script lang="ts">
	import { Activity, Cpu, MemoryStick, RotateCcw, Terminal, Upload, LockKeyhole } from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { ActivePayload, LabResponse } from '$lib/types/lab';

	type Props = {
		running: string;
		activePayload: ActivePayload | null;
		onCustomerProbe: () => void | Promise<void>;
		onCpuBlast: () => void | Promise<void>;
		onMemoryBlast: () => void | Promise<void>;
		onStopPayloads: () => void | Promise<void>;
	};

	let {
		running,
		activePayload,
		onCustomerProbe,
		onCpuBlast,
		onMemoryBlast,
		onStopPayloads
	}: Props = $props();

	let uploadResult = $state<LabResponse | null>(null);
	let pingResult = $state<LabResponse | null>(null);
	let ransomwareResult = $state<LabResponse | null>(null);
	let localRunning = $state('');
	let pingHost = $state('127.0.0.1; id; cat /proc/self/uid_map');

	const busy = $derived(Boolean(running));
	const localBusy = $derived(Boolean(localRunning));
	const scenarioBlocked = $derived(busy || Boolean(activePayload));

	async function runUploadExploit() {
		localRunning = 'upload';
		const payload = [
			'#!/usr/bin/env bash',
			'set -Eeuo pipefail',
			'echo "[dokuru baseline] payload executed as $(id)"',
			'echo "host=$(hostname) at=$(date -Is)"',
			'touch /tmp/dokuru-baseline-host-root-proof',
			''
		].join('\n');

		const form = new FormData();
		form.set('file', new File([payload], 'vacation_photo.jpg.sh', { type: 'image/jpeg' }));
		uploadResult = await requestJson('/api/upload', { method: 'POST', body: form });
		localRunning = '';
	}

	async function triggerHostCron() {
		localRunning = 'trigger-cron';
		uploadResult = await requestJson('/api/exploit/trigger-cron', { method: 'POST' });
		localRunning = '';
	}

	async function runCommandInjection() {
		localRunning = 'ping';
		pingResult = await requestJson(`/api/ping?host=${encodeURIComponent(pingHost)}`);
		localRunning = '';
	}

	async function runRansomware() {
		localRunning = 'ransomware';
		ransomwareResult = await requestJson('/api/exploit/ransomware', { method: 'POST' });
		localRunning = '';
	}

	async function resetExploitState() {
		localRunning = 'reset';
		ransomwareResult = await requestJson('/api/exploit/reset', { method: 'POST' });
		localRunning = '';
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

	function summary(value: LabResponse | null): string {
		if (!value) return 'No result yet.';
		return JSON.stringify(value, null, 2).slice(0, 1400);
	}
</script>

<Panel title="Baseline exploit chain" subtitle="Default Docker" class="@4xl/main:col-span-7">
	{#if activePayload}
		<div class="mb-4 flex flex-col gap-3 rounded-xl border border-commerce/20 bg-commerce/5 p-3 @md/main:flex-row @md/main:items-center @md/main:justify-between">
			<div>
				<p class="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-commerce">Active payload</p>
				<p class="m-0 mt-1 text-[13px] font-medium text-ink">{activePayload.label}</p>
			</div>
			<Button size="sm" variant="commerce" onclick={onStopPayloads} disabled={running === 'stop-payloads'}>Stop payload</Button>
		</div>
	{/if}

	<div class="grid gap-3 @xl/main:grid-cols-2">
		<article class="group rounded-[12px] border border-commerce/20 bg-commerce/5 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-commerce/35 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)] @xl/main:col-span-2">
			<div class="mb-3 flex flex-wrap items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<Upload size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B0</span>
					<span class="ml-1.5">File Upload Privesc</span>
				</span>
				<span class="rounded-full bg-commerce px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white">star demo</span>
			</div>
			<p class="m-0 mb-3 text-[13px] leading-relaxed text-body-gray">
				Upload a <code>.sh</code> payload disguised as an image. Docker default has no user namespace remap, so the bind-mounted file lands as host <code>root:root</code>.
			</p>
			<div class="mb-3 flex flex-wrap gap-2">
				<Button size="sm" onclick={runUploadExploit} disabled={busy || localBusy}>Run file upload exploit</Button>
				<Button size="sm" variant="ghost" onclick={triggerHostCron} disabled={busy || localBusy}>Trigger host cron</Button>
			</div>
			<pre class="m-0 max-h-52 overflow-auto rounded-lg border border-commerce/15 bg-white/80 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(uploadResult)}</pre>
		</article>

		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<Terminal size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B0a</span>
					<span class="ml-1.5">Command injection</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Inject shell through <code>/api/ping</code>. The compromised process runs as UID 0 because the image defaults to root.
			</p>
			<input
				value={pingHost}
				oninput={(event) => (pingHost = event.currentTarget.value)}
				class="mb-2.5 w-full rounded-[3px] border border-[#cccccc] bg-white px-3 py-2 font-mono text-[12.5px] text-ink transition focus:ring-2 focus:ring-playstation-blue focus:outline-none"
				aria-label="Ping host payload"
			/>
			<Button size="sm" onclick={runCommandInjection} disabled={busy || localBusy}>Execute injection</Button>
			<pre class="mt-3 mb-0 max-h-44 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(pingResult)}</pre>
		</article>

		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<LockKeyhole size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B0c</span>
					<span class="ml-1.5">Ransomware strike</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Encrypt demo customer files with a reversible payload. Reset restores <code>.bak</code> files and clears active pressure processes.
			</p>
			<div class="mb-3 flex flex-wrap gap-2">
				<Button size="sm" variant="commerce" onclick={runRansomware} disabled={busy || localBusy}>Execute ransomware</Button>
				<Button size="sm" variant="ghost" onclick={resetExploitState} disabled={busy || localBusy}>
					<span class="inline-flex items-center gap-1.5"><RotateCcw size={13} strokeWidth={2} /> Reset</span>
				</Button>
			</div>
			<pre class="m-0 max-h-44 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(ransomwareResult)}</pre>
		</article>

		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-playstation-blue/10 text-playstation-blue" aria-hidden="true">
					<Activity size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">Baseline customer</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Probe <code>victim-checkout</code> directly to confirm the neighbor service is healthy before any payload runs.
			</p>
			<Button size="sm" variant="ghost" onclick={onCustomerProbe} disabled={busy}>Probe checkout</Button>
		</article>

		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<Cpu size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B1</span>
					<span class="ml-1.5">Cryptominer</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Oversubscribe every vCPU with short-lived miners. Watch Active burners and customer latency when no CPU quota is configured.
			</p>
			<Button size="sm" onclick={onCpuBlast} disabled={scenarioBlocked}>Deploy cryptominer</Button>
		</article>

		<article class="group rounded-[12px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<MemoryStick size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B2</span>
					<span class="ml-1.5">Memory blast</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Start a child process that tries to hold 3072 MiB. Use Stop payload to terminate it; with rule 5.11, only that process is OOM-killed.
			</p>
			<Button size="sm" onclick={onMemoryBlast} disabled={scenarioBlocked}>Trigger memory blast</Button>
		</article>
	</div>
</Panel>
