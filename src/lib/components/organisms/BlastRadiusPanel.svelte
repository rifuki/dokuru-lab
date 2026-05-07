<script lang="ts">
	import {
		Activity,
		Cpu,
		Database,
		FileSearch,
		LockKeyhole,
		MemoryStick,
		RotateCcw,
		ShieldCheck,
		Terminal,
		Trash2,
		Upload
	} from '@lucide/svelte';
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

	let setupResult = $state<LabResponse | null>(null);
	let uploadResult = $state<LabResponse | null>(null);
	let pingResult = $state<LabResponse | null>(null);
	let dumpResult = $state<LabResponse | null>(null);
	let ransomwareResult = $state<LabResponse | null>(null);
	let localRunning = $state('');
	let pingHost = $state('127.0.0.1; id; cat /proc/self/uid_map; cat /sys/fs/cgroup/memory.max; cat /sys/fs/cgroup/cpu.max');

	const busy = $derived(Boolean(running));
	const localBusy = $derived(Boolean(localRunning));
	const scenarioBlocked = $derived(busy || Boolean(activePayload));

	async function seedMockData() {
		await runLocal('seed', async () => {
			setupResult = await requestJson('/api/demo/seed', { method: 'POST' });
		});
	}

	async function verifyBaseline() {
		await runLocal('verify', async () => {
			setupResult = await requestJson('/api/health');
		});
	}

	async function cleanupPayloads() {
		await runLocal('cleanup', async () => {
			setupResult = await requestJson('/api/cleanup', { method: 'POST' });
		});
	}

	async function resetDemoState() {
		await runLocal('demo-reset', async () => {
			const result = await requestJson('/api/demo/reset', { method: 'POST' });
			setupResult = result;
			ransomwareResult = result;
		});
	}

	async function runUploadOwnershipProof() {
		await runLocal('upload', async () => {
			const payload = [
				'Dokuru baseline ownership proof',
				`created_at=${new Date().toISOString()}`,
				'purpose=container-root-writes-bind-mount-as-host-root',
				''
			].join('\n');

			const form = new FormData();
			form.set('file', new File([payload], 'ownership-proof.txt', { type: 'text/plain' }));
			uploadResult = await requestJson('/api/upload', { method: 'POST', body: form });
		});
	}

	async function runCommandInjection() {
		await runLocal('ping', async () => {
			pingResult = await requestJson(`/api/ping?host=${encodeURIComponent(pingHost)}`);
		});
	}

	async function dumpAppData() {
		await runLocal('dump', async () => {
			dumpResult = await requestJson('/api/demo/dump', { method: 'POST' });
		});
	}

	async function runRansomware() {
		await runLocal('ransomware', async () => {
			ransomwareResult = await requestJson('/api/exploit/ransomware', { method: 'POST' });
		});
	}

	async function restoreDemoData() {
		await runLocal('restore', async () => {
			ransomwareResult = await requestJson('/api/demo/reset', { method: 'POST' });
		});
	}

	async function runLocal(label: string, action: () => Promise<void>) {
		localRunning = label;
		try {
			await action();
		} finally {
			localRunning = '';
		}
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

	function summary(value: LabResponse | null, size = 1800): string {
		if (!value) return 'No result yet.';
		return JSON.stringify(value, null, 2).slice(0, size);
	}
</script>

<Panel title="Baseline exploit chain" subtitle="Command injection to app/data compromise" class="@4xl/main:col-span-7">
	{#if activePayload}
		<div class="mb-4 flex flex-col gap-3 rounded-lg border border-commerce/20 bg-commerce/5 p-3 @md/main:flex-row @md/main:items-center @md/main:justify-between">
			<div>
				<p class="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-commerce">Active payload</p>
				<p class="m-0 mt-1 text-[13px] font-medium text-ink">{activePayload.label}</p>
			</div>
			<Button size="sm" variant="commerce" onclick={onStopPayloads} disabled={running === 'stop-payloads'}>Stop payload</Button>
		</div>
	{/if}

	<div class="grid gap-3 @xl/main:grid-cols-2">
		<article class="@xl/main:col-span-2 rounded-[8px] border border-playstation-blue/20 bg-white p-4">
			<div class="mb-3 flex flex-wrap items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-playstation-blue/10 text-playstation-blue" aria-hidden="true">
					<ShieldCheck size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">Demo setup and recovery</span>
				<span class="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-body-gray">repeatable</span>
			</div>
			<p class="m-0 mb-3 text-[13px] leading-relaxed text-body-gray">
				Prepare mock customers, verify default Docker evidence, and reset chaos payloads without leaving the browser.
			</p>
			<div class="mb-3 flex flex-wrap gap-2">
				<Button size="sm" onclick={seedMockData} disabled={busy || localBusy}>
					<span class="inline-flex items-center gap-1.5"><Database size={13} strokeWidth={2} /> Seed mock data</span>
				</Button>
				<Button size="sm" variant="ghost" onclick={verifyBaseline} disabled={busy || localBusy}>Verify baseline</Button>
				<Button size="sm" variant="ghost" onclick={cleanupPayloads} disabled={busy || localBusy}>
					<span class="inline-flex items-center gap-1.5"><Trash2 size={13} strokeWidth={2} /> Cleanup payloads</span>
				</Button>
				<Button size="sm" variant="ghost" onclick={resetDemoState} disabled={busy || localBusy}>
					<span class="inline-flex items-center gap-1.5"><RotateCcw size={13} strokeWidth={2} /> Reset demo state</span>
				</Button>
			</div>
			<pre class="m-0 max-h-52 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(setupResult)}</pre>
		</article>

		<article class="group rounded-[8px] border border-commerce/20 bg-commerce/5 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-commerce/35 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)] @xl/main:col-span-2">
			<div class="mb-3 flex flex-wrap items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<Terminal size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B0</span>
					<span class="ml-1.5">Command Injection RCE</span>
				</span>
				<span class="rounded-full bg-commerce px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white">star demo</span>
			</div>
			<p class="m-0 mb-3 text-[13px] leading-relaxed text-body-gray">
				A diagnostic endpoint passes input to <code>ping</code> through the shell. CVE-backed pattern: TP-Link CVE-2023-1389, Cisco CVE-2023-20231, Palo Alto CVE-2024-3400, and Ivanti CVE-2024-21887.
			</p>
			<input
				value={pingHost}
				oninput={(event) => (pingHost = event.currentTarget.value)}
				class="mb-2.5 w-full rounded-[3px] border border-[#cccccc] bg-white px-3 py-2 font-mono text-[12.5px] text-ink transition focus:ring-2 focus:ring-playstation-blue focus:outline-none"
				aria-label="Ping host payload"
			/>
			<Button size="sm" onclick={runCommandInjection} disabled={busy || localBusy}>Execute injection</Button>
			<pre class="mt-3 mb-0 max-h-56 overflow-auto rounded-lg border border-commerce/15 bg-white/80 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(pingResult, 2200)}</pre>
		</article>

		<article class="group rounded-[8px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<Upload size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B1</span>
					<span class="ml-1.5">Bind Mount Ownership</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Write a harmless marker into <code>/app/uploads</code>. On the Linux host it appears as UID/GID <code>0:0</code> because userns remap is off.
			</p>
			<Button size="sm" onclick={runUploadOwnershipProof} disabled={busy || localBusy}>Write ownership marker</Button>
			<pre class="mt-3 mb-0 max-h-44 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(uploadResult)}</pre>
		</article>

		<article class="group rounded-[8px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-playstation-blue/10 text-playstation-blue" aria-hidden="true">
					<FileSearch size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B2</span>
					<span class="ml-1.5">Dump App Data</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Simulate malware-style collection: sample customer files, invoice files, and reachable Postgres rows from the compromised app network.
			</p>
			<Button size="sm" variant="ghost" onclick={dumpAppData} disabled={busy || localBusy}>Dump sample data</Button>
			<pre class="mt-3 mb-0 max-h-44 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(dumpResult)}</pre>
		</article>

		<article class="group rounded-[8px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)] @xl/main:col-span-2">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<LockKeyhole size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B3</span>
					<span class="ml-1.5">App Data Ransomware</span>
				</span>
			</div>
			<p class="m-0 mb-3 text-[13px] leading-relaxed text-body-gray">
				Encrypt 200 mock customer files with a reversible payload. This is the honest impact: total app/data compromise without claiming host shell.
			</p>
			<div class="mb-3 flex flex-wrap gap-2">
				<Button size="sm" variant="commerce" onclick={runRansomware} disabled={busy || localBusy}>Encrypt customer files</Button>
				<Button size="sm" variant="ghost" onclick={restoreDemoData} disabled={busy || localBusy}>
					<span class="inline-flex items-center gap-1.5"><RotateCcw size={13} strokeWidth={2} /> Restore data</span>
				</Button>
			</div>
			<pre class="m-0 max-h-52 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(ransomwareResult, 2200)}</pre>
		</article>

		<article class="group rounded-[8px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-playstation-blue/10 text-playstation-blue" aria-hidden="true">
					<Activity size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">Baseline customer</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Probe <code>victim-checkout</code> directly to confirm the neighbor service is healthy before pressure payloads run.
			</p>
			<Button size="sm" variant="ghost" onclick={onCustomerProbe} disabled={busy}>Probe checkout</Button>
		</article>

		<article class="group rounded-[8px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<Cpu size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B4</span>
					<span class="ml-1.5">Cryptominer</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Oversubscribe every vCPU with short-lived miners. Watch customer latency when no CPU quota is configured.
			</p>
			<Button size="sm" onclick={onCpuBlast} disabled={scenarioBlocked}>Deploy cryptominer</Button>
		</article>

		<article class="group rounded-[8px] border border-divider p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce" aria-hidden="true">
					<MemoryStick size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">B5</span>
					<span class="ml-1.5">Memory Blast</span>
				</span>
			</div>
			<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
				Hold 3072 MiB from the compromised service. With rule 5.11 applied, only this container should be constrained.
			</p>
			<Button size="sm" onclick={onMemoryBlast} disabled={scenarioBlocked}>Trigger memory blast</Button>
		</article>
	</div>
</Panel>
