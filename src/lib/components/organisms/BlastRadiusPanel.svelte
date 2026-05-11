<script lang="ts">
	import {
		Activity,
		FileSearch,
		KeySquare,
		LockKeyhole,
		RotateCcw,
		ShieldAlert,
		ShieldCheck,
		Terminal,
		Upload
	} from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { ActivePayload, LabResponse } from '$lib/types/lab';

	type Props = {
		running: string;
		activePayload: ActivePayload | null;
		onCustomerProbe: () => void | Promise<void>;
		onStopPayloads: () => void | Promise<void>;
		onTerminalLine?: (stream: 'system' | 'stdin' | 'stdout' | 'stderr', text: string) => void;
	};

	let {
		running,
		activePayload,
		onCustomerProbe,
		onStopPayloads,
		onTerminalLine
	}: Props = $props();

	// Section A: Entry point
	let pingResult = $state<LabResponse | null>(null);
	let pingHost = $state('127.0.0.1; id; cat /proc/self/uid_map; cat /sys/fs/cgroup/memory.max');

	// Section B: Docker misconfig exploits (Dokuru fixes these)
	let uploadResult = $state<LabResponse | null>(null);
	let suidResult = $state<LabResponse | null>(null);
	let setcapResult = $state<LabResponse | null>(null);

	// Section C: App-level consequences (Dokuru does not fix)
	let dumpResult = $state<LabResponse | null>(null);
	let ransomwareResult = $state<LabResponse | null>(null);

	let localRunning = $state('');

	const busy = $derived(Boolean(running));
	const localBusy = $derived(Boolean(localRunning));

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

	async function runSuidTrap() {
		await runLocal('suid-trap', async () => {
			suidResult = await requestJson('/api/exploit/suid-trap', { method: 'POST' });
		});
	}

	async function runSetcapTrap() {
		await runLocal('setcap-trap', async () => {
			setcapResult = await requestJson('/api/exploit/setcap-trap', { method: 'POST' });
		});
	}

	async function runCleanupTraps() {
		await runLocal('cleanup-traps', async () => {
			const result = await requestJson('/api/exploit/cleanup-traps', { method: 'POST' });
			suidResult = result;
			setcapResult = result;
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
		onTerminalLine?.('system', `$ fetch ${options.method || 'GET'} ${path}\n`);
		try {
			const response = await fetch(path, options);
			const text = await response.text();
			const parsed = JSON.parse(text) as LabResponse;
			onTerminalLine?.(
				'stdout',
				`${JSON.stringify({ http_status: response.status, ...parsed }, null, 2).slice(0, 4000)}\n`
			);
			return { http_status: response.status, ...parsed };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			onTerminalLine?.('stderr', `${message}\n`);
			return { ok: false, error: message };
		}
	}

	function summary(value: LabResponse | null, size = 1800): string {
		if (!value) return 'No result yet.';
		return JSON.stringify(value, null, 2).slice(0, size);
	}
</script>

<Panel title="Baseline exploit chain" class="@4xl/main:col-span-7">
	{#if activePayload}
		<div
			class="mb-4 flex flex-col gap-3 rounded-lg border border-commerce/20 bg-commerce/5 p-3 @md/main:flex-row @md/main:items-center @md/main:justify-between"
		>
			<div>
				<p class="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-commerce">
					Active payload
				</p>
				<p class="m-0 mt-1 text-[13px] font-medium text-ink">{activePayload.label}</p>
			</div>
			<Button
				size="sm"
				variant="commerce"
				onclick={onStopPayloads}
				disabled={running === 'stop-payloads'}>Stop payload</Button
			>
		</div>
	{/if}

	<!-- ═══════════════════════════════════════════════════════════════════ -->
	<!-- Section A · Entry point (app bug — Dokuru doesn't patch this)       -->
	<!-- ═══════════════════════════════════════════════════════════════════ -->
	<div class="mb-5">
		<div class="mb-2 flex items-center gap-2">
			<span class="font-mono text-[10.5px] uppercase tracking-[0.14em] text-body-gray">A</span>
			<span class="text-[13px] font-semibold text-ink">Entry point</span>
			<span class="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-body-gray"
				>app-level bug · not patched by Dokuru</span
			>
		</div>

		<article
			class="group rounded-[8px] border border-commerce/20 bg-commerce/5 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-commerce/35 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]"
		>
			<div class="mb-3 flex flex-wrap items-center gap-2.5">
				<span
					class="grid h-7 w-7 place-items-center rounded-md bg-commerce/10 text-commerce"
					aria-hidden="true"
				>
					<Terminal size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[13.5px] font-medium text-ink">
					<span class="font-mono text-[11.5px] text-body-gray">A0</span>
					<span class="ml-1.5">Command Injection RCE</span>
				</span>
				<span
					class="rounded-full bg-commerce px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white"
					>star demo</span
				>
			</div>
			<p class="m-0 mb-3 text-[13px] leading-relaxed text-body-gray">
				A diagnostic endpoint passes input to <code>ping</code> through the shell. Real-world pattern:
				TP-Link CVE-2023-1389, Cisco CVE-2023-20231, Palo Alto CVE-2024-3400, Ivanti CVE-2024-21887.
				This is an application bug — Dokuru does not fix application code, but it neutralizes the
				blast radius.
			</p>
			<input
				value={pingHost}
				oninput={(event) => (pingHost = event.currentTarget.value)}
				class="mb-2.5 w-full rounded-[3px] border border-[#cccccc] bg-white px-3 py-2 font-mono text-[12.5px] text-ink transition focus:ring-2 focus:ring-playstation-blue focus:outline-none"
				aria-label="Ping host payload"
			/>
			<Button size="sm" onclick={runCommandInjection} disabled={busy || localBusy}
				>Execute injection</Button
			>
			<pre
				class="mt-3 mb-0 max-h-56 overflow-auto rounded-lg border border-commerce/15 bg-white/80 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(
					pingResult,
					2200
				)}</pre>
		</article>
	</div>

	<!-- ═══════════════════════════════════════════════════════════════════ -->
	<!-- Section B · Docker misconfig exploits (Dokuru fixes rule 2.10)      -->
	<!-- ═══════════════════════════════════════════════════════════════════ -->
	<div class="mb-5">
		<div class="mb-2 flex items-center gap-2">
			<span class="font-mono text-[10.5px] uppercase tracking-[0.14em] text-playstation-blue">B</span>
			<span class="text-[13px] font-semibold text-ink">Docker misconfig exploits</span>
			<span
				class="rounded-full bg-playstation-blue/10 px-2 py-0.5 font-mono text-[10px] text-playstation-blue"
				>Dokuru fixes these · rule 2.10 userns-remap</span
			>
		</div>
		<p class="m-0 mb-3 text-[12.5px] leading-relaxed text-body-gray">
			These attacks succeed on default Docker because container root equals host root for bind mount
			operations. Enabling <code>userns-remap</code> (rule 2.10) neutralizes each primitive.
		</p>

		<div class="grid gap-3 @xl/main:grid-cols-2">
			<article
				class="group rounded-[8px] border border-playstation-blue/25 bg-white p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-playstation-blue/40 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]"
			>
				<div class="mb-3 flex items-center gap-2.5">
					<span
						class="grid h-7 w-7 place-items-center rounded-md bg-playstation-blue/10 text-playstation-blue"
						aria-hidden="true"
					>
						<Upload size={14} strokeWidth={2.2} />
					</span>
					<span class="text-[13.5px] font-medium text-ink">
						<span class="font-mono text-[11.5px] text-body-gray">B1</span>
						<span class="ml-1.5">Bind Mount Ownership</span>
					</span>
				</div>
				<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
					Write a harmless marker into <code>/app/uploads</code>. Before fix: file appears on host
					as UID/GID <code>0:0</code>. After fix: file appears as remapped UID (e.g.{' '}
					<code>100000</code>) — owner mismatch, file has no host privileges.
				</p>
				<Button size="sm" onclick={runUploadOwnershipProof} disabled={busy || localBusy}
					>Write ownership marker</Button
				>
				<pre
					class="mt-3 mb-0 max-h-44 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(
						uploadResult
					)}</pre>
			</article>

			<article
				class="group rounded-[8px] border-2 border-commerce/40 bg-commerce/[0.03] p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-commerce/60 hover:shadow-[0_5px_9px_rgba(0,0,0,0.08)]"
			>
				<div class="mb-3 flex flex-wrap items-center gap-2.5">
					<span
						class="grid h-7 w-7 place-items-center rounded-md bg-commerce/15 text-commerce"
						aria-hidden="true"
					>
						<ShieldAlert size={14} strokeWidth={2.2} />
					</span>
					<span class="text-[13.5px] font-medium text-ink">
						<span class="font-mono text-[11.5px] text-body-gray">B2</span>
						<span class="ml-1.5">SUID LPE Honeypot</span>
					</span>
					<span
						class="rounded-full bg-commerce px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white"
						>key demo</span
					>
				</div>
				<p class="m-0 mb-3 text-[13px] leading-relaxed text-body-gray">
					Attacker drops <code>/bin/bash</code> into uploads with SUID bit set. Before fix: file is
					SUID-root on host; admin executing <code>./system-health-check -p</code> becomes root.
					After fix: file is SUID but owned by remapped UID — admin stays unprivileged.
				</p>
				<div class="flex flex-wrap gap-2">
					<Button size="sm" variant="commerce" onclick={runSuidTrap} disabled={busy || localBusy}
						>Plant SUID trap</Button
					>
					<Button size="sm" variant="ghost" onclick={runCleanupTraps} disabled={busy || localBusy}>
						<span class="inline-flex items-center gap-1.5"
							><RotateCcw size={13} strokeWidth={2} /> Cleanup traps</span
						>
					</Button>
				</div>
				<pre
					class="mt-3 mb-0 max-h-56 overflow-auto rounded-lg border border-commerce/20 bg-white/70 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(
						suidResult,
						2400
					)}</pre>
			</article>

			<article
				class="group rounded-[8px] border border-playstation-blue/25 bg-white p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-playstation-blue/40 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)] @xl/main:col-span-2"
			>
				<div class="mb-3 flex flex-wrap items-center gap-2.5">
					<span
						class="grid h-7 w-7 place-items-center rounded-md bg-playstation-blue/10 text-playstation-blue"
						aria-hidden="true"
					>
						<KeySquare size={14} strokeWidth={2.2} />
					</span>
					<span class="text-[13.5px] font-medium text-ink">
						<span class="font-mono text-[11.5px] text-body-gray">B3</span>
						<span class="ml-1.5">Linux Capability Trap (setcap)</span>
					</span>
					<span
						class="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-body-gray"
						>advanced</span
					>
				</div>
				<p class="m-0 mb-3 text-[13px] leading-relaxed text-body-gray">
					Attacker uses <code>setcap</code> to grant a binary network admin + raw socket
					capabilities. Before fix: <code>setcap</code> succeeds because container root equals host
					root. After fix: kernel rejects <code>setcap</code> because remapped root lacks
					<code>CAP_SETFCAP</code> in the init user namespace.
				</p>
				<Button size="sm" onclick={runSetcapTrap} disabled={busy || localBusy}
					>Plant setcap trap</Button
				>
				<pre
					class="mt-3 mb-0 max-h-48 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(
						setcapResult,
						2200
					)}</pre>
			</article>
		</div>
	</div>

	<!-- ═══════════════════════════════════════════════════════════════════ -->
	<!-- Section C · App-level consequences (Dokuru does NOT fix directly)   -->
	<!-- ═══════════════════════════════════════════════════════════════════ -->
	<div>
		<div class="mb-2 flex items-center gap-2">
			<span class="font-mono text-[10.5px] uppercase tracking-[0.14em] text-body-gray">C</span>
			<span class="text-[13px] font-semibold text-ink">App-level consequences</span>
			<span class="rounded-full bg-amber-50 px-2 py-0.5 font-mono text-[10px] text-amber-700"
				>Dokuru limits blast radius, does not block directly</span
			>
		</div>
		<p class="m-0 mb-3 text-[12.5px] leading-relaxed text-body-gray">
			These succeed whether Dokuru is applied or not, because attacker already has legitimate
			app-level write access. The fix belongs at the application layer (input validation, secrets
			management). Dokuru confines these to app data scope instead of host-wide damage.
		</p>

		<div class="grid gap-3 @xl/main:grid-cols-2">
			<article
				class="group rounded-[8px] border border-divider bg-white p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]"
			>
				<div class="mb-3 flex items-center gap-2.5">
					<span
						class="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-body-gray"
						aria-hidden="true"
					>
						<FileSearch size={14} strokeWidth={2.2} />
					</span>
					<span class="text-[13.5px] font-medium text-ink">
						<span class="font-mono text-[11.5px] text-body-gray">C1</span>
						<span class="ml-1.5">Dump App Data</span>
					</span>
				</div>
				<p class="m-0 mb-3 min-h-12 text-[13px] leading-relaxed text-body-gray">
					Sample customer files, invoice files, and reachable Postgres rows. Works regardless of
					Dokuru fix because attacker has legitimate app network and filesystem reach.
				</p>
				<Button size="sm" variant="ghost" onclick={dumpAppData} disabled={busy || localBusy}
					>Dump sample data</Button
				>
				<pre
					class="mt-3 mb-0 max-h-44 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(
						dumpResult
					)}</pre>
			</article>

			<article
				class="group rounded-[8px] border border-divider bg-white p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_5px_9px_rgba(0,0,0,0.06)]"
			>
				<div class="mb-3 flex items-center gap-2.5">
					<span
						class="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-body-gray"
						aria-hidden="true"
					>
						<LockKeyhole size={14} strokeWidth={2.2} />
					</span>
					<span class="text-[13.5px] font-medium text-ink">
						<span class="font-mono text-[11.5px] text-body-gray">C2</span>
						<span class="ml-1.5">App Data Ransomware</span>
					</span>
				</div>
				<p class="m-0 mb-3 text-[13px] leading-relaxed text-body-gray">
					Encrypt 200 mock customer files with a reversible payload. Honest impact: app data
					compromise within the writable uploads directory — scope is the same before and after
					Dokuru fix.
				</p>
				<div class="flex flex-wrap gap-2">
					<Button
						size="sm"
						variant="commerce"
						onclick={runRansomware}
						disabled={busy || localBusy}>Encrypt customer files</Button
					>
					<Button
						size="sm"
						variant="ghost"
						onclick={restoreDemoData}
						disabled={busy || localBusy}
					>
						<span class="inline-flex items-center gap-1.5"
							><RotateCcw size={13} strokeWidth={2} /> Restore data</span
						>
					</Button>
				</div>
				<pre
					class="mt-3 mb-0 max-h-44 overflow-auto rounded-lg border border-divider bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-ink">{summary(
						ransomwareResult,
						2000
					)}</pre>
			</article>
		</div>
	</div>

	<!-- ═══════════════════════════════════════════════════════════════════ -->
	<!-- Footer · Baseline probe helper                                      -->
	<!-- ═══════════════════════════════════════════════════════════════════ -->
	<div class="mt-5 flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
		<div class="min-w-0">
			<p class="m-0 text-[11.5px] font-mono uppercase tracking-[0.1em] text-body-gray">
				<ShieldCheck size={12} strokeWidth={2} class="mr-1 inline-block" />
				Baseline probe
			</p>
			<p class="m-0 mt-0.5 text-[12.5px] leading-snug text-body-gray">
				Direct probe to the Protected Checkout API (<code>checkout-api</code>) confirms the neighbor service is healthy before
				pressure payloads.
			</p>
		</div>
		<Button size="sm" variant="ghost" onclick={onCustomerProbe} disabled={busy}>
			<span class="inline-flex items-center gap-1.5"
				><Activity size={13} strokeWidth={2} /> Probe protected API</span
			>
		</Button>
	</div>
</Panel>
