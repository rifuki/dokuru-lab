<script lang="ts">
	import { onMount } from 'svelte';
	import BlastRadiusPanel from '$lib/components/organisms/BlastRadiusPanel.svelte';
	import CgroupLabPanel from '$lib/components/organisms/CgroupLabPanel.svelte';
	import CustomerLiveView from '$lib/components/organisms/CustomerLiveView.svelte';
	import HeroSection from '$lib/components/organisms/HeroSection.svelte';
	import LiveMonitorPanel from '$lib/components/organisms/LiveMonitorPanel.svelte';
	import Masthead from '$lib/components/organisms/Masthead.svelte';
	import NamespaceLabPanel from '$lib/components/organisms/NamespaceLabPanel.svelte';
	import ProofChecklistPanel from '$lib/components/organisms/ProofChecklistPanel.svelte';
	import RuntimeEvidencePanel from '$lib/components/organisms/RuntimeEvidencePanel.svelte';
	import TerminalPanel, { type TerminalLine } from '$lib/components/organisms/TerminalPanel.svelte';
	import type { CommandPreset, CustomerSample, LabResponse, RuntimeEvidence } from '$lib/types/lab';

	let command = $state('id; cat /proc/self/uid_map; cat /proc/self/gid_map');
	let pidCount = $state(120);
	let memoryMb = $state(128);
	let cpuSeconds = $state(5);
	let running = $state('');
	let evidenceData = $state<LabResponse | null>(null);
	let cgroupResult = $state<LabResponse | null>(null);
	let lastUpdated = $state('');
	let terminalLines = $state<TerminalLine[]>([]);
	let customerSamples = $state<CustomerSample[]>([]);
	let terminalConnected = $state(false);
	let monitorConnected = $state(false);
	let customerConnected = $state(false);
	let terminalSocket: WebSocket | null = null;
	let monitorSocket: WebSocket | null = null;
	let customerSocket: WebSocket | null = null;
	let mounted = false;

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
		mounted = true;
		connectMonitor();
		connectTerminal();
		connectCustomer();
		void refreshEvidence(true);
		return () => {
			mounted = false;
			terminalSocket?.close();
			monitorSocket?.close();
			customerSocket?.close();
		};
	});

	function connectMonitor() {
		monitorSocket = new WebSocket(wsUrl('/ws/monitor'));
		monitorSocket.onopen = () => (monitorConnected = true);
		monitorSocket.onmessage = (event) => {
			const message = parseSocketMessage(event.data);
			if (message?.type !== 'monitor.evidence') return;
			evidenceData = { ok: true, runtime: message.runtime as RuntimeEvidence };
			lastUpdated = timeLabel(message.at);
		};
		monitorSocket.onclose = () => {
			monitorConnected = false;
			if (mounted) window.setTimeout(connectMonitor, 900);
		};
	}

	function connectTerminal() {
		terminalSocket = new WebSocket(wsUrl('/ws/terminal'));
		terminalSocket.onopen = () => (terminalConnected = true);
		terminalSocket.onmessage = (event) => {
			const message = parseSocketMessage(event.data);
			if (!message) return;

			if (message.type === 'terminal.line') {
				pushTerminalLine({
					stream: message.stream as TerminalLine['stream'],
					text: String(message.text || ''),
					at: timeLabel(message.at)
				});
			}

			if (message.type === 'terminal.start') {
				running = String(message.action || 'terminal');
			}

			if (message.type === 'terminal.exit') {
				running = '';
				void refreshEvidence(false);
			}
		};
		terminalSocket.onclose = () => {
			terminalConnected = false;
			if (mounted) window.setTimeout(connectTerminal, 900);
		};
	}

	function connectCustomer() {
		customerSocket = new WebSocket(wsUrl('/ws/customer'));
		customerSocket.onopen = () => (customerConnected = true);
		customerSocket.onmessage = (event) => {
			const message = parseSocketMessage(event.data);
			if (message?.type !== 'customer.sample') return;
			const sample = message.sample as CustomerSample | undefined;
			if (!sample) return;
			customerSamples = [...customerSamples, sample].slice(-120);
		};
		customerSocket.onclose = () => {
			customerConnected = false;
			if (mounted) window.setTimeout(connectCustomer, 900);
		};
	}

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
		sendTerminal({ type: 'probe' });
	}

	function runExec() {
		sendTerminal({ type: 'exec', command });
	}

	function runPidBomb() {
		cgroupResult = { ok: true, scenario: 'PIDs cgroup pressure', requested: pidCount };
		sendTerminal({ type: 'pid-bomb', count: pidCount });
	}

	function runMemoryBomb() {
		sendTerminal({ type: 'memory-bomb', mb: memoryMb });
	}

	function runCpuBurn() {
		sendTerminal({ type: 'cpu-burn', seconds: cpuSeconds });
	}

	function runCustomerProbe() {
		sendTerminal({ type: 'customer-probe' });
	}

	function runCpuBlast() {
		sendTerminal({ type: 'cpu-blast', workers: 4, seconds: 25 });
	}

	function runMemoryBlast() {
		sendTerminal({ type: 'memory-bomb', mb: 1280 });
	}

	function runStealSecrets() {
		sendTerminal({ type: 'steal-secrets' });
	}

	function runSabotageProxy() {
		sendTerminal({ type: 'sabotage-proxy', seconds: 6 });
	}

	function cleanupPidBomb() {
		sendTerminal({ type: 'cleanup' });
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

	function sendTerminal(payload: Record<string, unknown>) {
		if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) {
			pushTerminalLine({
				stream: 'stderr',
				text: 'terminal websocket is not connected\n',
				at: timeLabel()
			});
			return;
		}

		terminalSocket.send(JSON.stringify(payload));
	}

	function clearTerminal() {
		terminalLines = [];
	}

	function pushTerminalLine(line: TerminalLine) {
		terminalLines = [...terminalLines, line].slice(-600);
	}

	function parseSocketMessage(value: unknown): Record<string, unknown> | null {
		try {
			return JSON.parse(String(value)) as Record<string, unknown>;
		} catch {
			return null;
		}
	}

	function wsUrl(path: string): string {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${protocol}//${window.location.host}${path}`;
	}

	function timeLabel(value?: unknown): string {
		const date = value ? new Date(String(value)) : new Date();
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

<Masthead onRefresh={() => refreshEvidence(true)} running={running === 'health'} />

<main>
	<HeroSection runtime={runtime} onProbe={runProbe} onRunCommand={runExec} {running} />

	<section class="bg-white px-4 py-14 md:px-16 lg:px-24 lg:py-[72px]">
		<div class="mx-auto mb-5 flex max-w-[1540px] flex-col justify-between gap-4 lg:flex-row lg:items-end">
			<div>
				<p class="m-0 mb-2 text-sm font-bold tracking-[0.12em] text-playstation-blue uppercase">Evidence board</p>
				<h2 class="m-0 text-[clamp(28px,4vw,42px)] leading-tight font-light text-black">Before / after evidence</h2>
			</div>
			<p class="m-0 max-w-2xl text-[16px] leading-relaxed text-body-gray">
				Start with the WebSocket monitor, run one proof at a time, then read the live terminal stdout/stderr while Dokuru fixes are compared.
			</p>
		</div>

		<div class="mx-auto grid max-w-[1540px] grid-cols-1 gap-4 lg:grid-cols-12">
			<LiveMonitorPanel runtime={runtime} {lastUpdated} connected={monitorConnected} />

			<CustomerLiveView samples={customerSamples} connected={customerConnected} />

			<BlastRadiusPanel
				{running}
				onCustomerProbe={runCustomerProbe}
				onCpuBlast={runCpuBlast}
				onMemoryBlast={runMemoryBlast}
				onStealSecrets={runStealSecrets}
				onSabotageProxy={runSabotageProxy}
			/>

			<TerminalPanel lines={terminalLines} connected={terminalConnected} busy={Boolean(running)} onClear={clearTerminal} />

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
				{running}
				onCommandChange={(value) => (command = value)}
				onRun={runExec}
			/>

			<CgroupLabPanel
				{pidCount}
				{memoryMb}
				{cpuSeconds}
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
