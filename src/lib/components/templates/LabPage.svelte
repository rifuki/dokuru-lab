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
	import TerminalDrawer from '$lib/components/organisms/TerminalDrawer.svelte';
	import type { TerminalLine } from '$lib/components/organisms/TerminalPanel.svelte';
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
	let terminalOpen = $state(false);
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
	const terminalBusy = $derived(Boolean(running));

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

	function toggleTerminal() {
		terminalOpen = !terminalOpen;
	}

	function closeTerminal() {
		terminalOpen = false;
	}

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

<div class="flex min-h-screen bg-white">
	<!-- Main column -->
	<div class="@container/page flex min-w-0 flex-1 flex-col">
		<Masthead
			onRefresh={() => refreshEvidence(true)}
			onToggleTerminal={toggleTerminal}
			running={running === 'health'}
			{terminalOpen}
			{terminalConnected}
			{terminalBusy}
		/>

		<main class="@container/main flex-1">
			<HeroSection {runtime} onProbe={runProbe} onRunCommand={runExec} {running} />

			<!-- Section 01 · Live monitor -->
			<section id="monitor" class="scroll-mt-20 bg-white px-4 py-12 sm:px-6 md:px-8 lg:py-16">
				<div class="mx-auto max-w-[1480px]">
					<header class="mb-6 flex flex-col justify-between gap-3 @4xl/main:flex-row @4xl/main:items-end">
						<div>
							<p class="m-0 mb-2 text-[12px] font-bold tracking-[0.16em] text-playstation-blue uppercase">Section 01 &middot; Live monitor</p>
							<h2 class="m-0 text-[clamp(26px,3.4vw,38px)] leading-tight font-light text-black">Real-time namespace and cgroup signals</h2>
						</div>
						<p class="m-0 max-w-xl text-[14.5px] leading-relaxed text-body-gray">
							Streamed over <code>/ws/monitor</code> straight from <code>dokuru-lab</code>. Each metric reacts as you trigger payloads from the next section.
						</p>
					</header>

					<LiveMonitorPanel {runtime} {lastUpdated} connected={monitorConnected} />
				</div>
			</section>

			<!-- Section 02 · Blast-radius scenarios -->
			<section id="scenarios" class="scroll-mt-20 bg-gradient-to-b from-white to-ice px-4 py-12 sm:px-6 md:px-8 lg:py-16">
				<div class="mx-auto max-w-[1480px]">
					<header class="mb-6 flex flex-col justify-between gap-3 @4xl/main:flex-row @4xl/main:items-end">
						<div>
							<p class="m-0 mb-2 text-[12px] font-bold tracking-[0.16em] text-playstation-blue uppercase">Section 02 &middot; Blast radius</p>
							<h2 class="m-0 text-[clamp(26px,3.4vw,38px)] leading-tight font-light text-black">Trigger a payload, watch the neighbor</h2>
						</div>
						<p class="m-0 max-w-xl text-[14.5px] leading-relaxed text-body-gray">
							Each scenario runs from inside <code>dokuru-lab</code>. Open the terminal sidebar to follow stdout/stderr while the customer signal updates live.
						</p>
					</header>

					<div class="grid grid-cols-1 gap-4 @4xl/main:grid-cols-12">
						<CustomerLiveView samples={customerSamples} connected={customerConnected} />
						<BlastRadiusPanel
							{running}
							onCustomerProbe={runCustomerProbe}
							onCpuBlast={runCpuBlast}
							onMemoryBlast={runMemoryBlast}
							onStealSecrets={runStealSecrets}
							onSabotageProxy={runSabotageProxy}
						/>
					</div>
				</div>
			</section>

			<!-- Section 03 · Namespace isolation -->
			<section id="namespace" class="scroll-mt-20 bg-white px-4 py-12 sm:px-6 md:px-8 lg:py-16">
				<div class="mx-auto max-w-[1480px]">
					<header class="mb-6 flex flex-col justify-between gap-3 @4xl/main:flex-row @4xl/main:items-end">
						<div>
							<p class="m-0 mb-2 text-[12px] font-bold tracking-[0.16em] text-playstation-blue uppercase">Section 03 &middot; Namespace isolation</p>
							<h2 class="m-0 text-[clamp(26px,3.4vw,38px)] leading-tight font-light text-black">Prove what the container can see</h2>
						</div>
						<p class="m-0 max-w-xl text-[14.5px] leading-relaxed text-body-gray">
							CIS Docker Benchmark rules <strong>2.10</strong>, <strong>5.16</strong>, <strong>5.17</strong>, <strong>5.21</strong>, <strong>5.31</strong>. Capture proof output before and after Dokuru recreates the container.
						</p>
					</header>

					<NamespaceLabPanel
						{command}
						{presets}
						{running}
						onCommandChange={(value) => (command = value)}
						onRun={runExec}
					/>
				</div>
			</section>

			<!-- Section 04 · Cgroup controls -->
			<section id="cgroup" class="scroll-mt-20 bg-gradient-to-b from-white to-ice px-4 py-12 sm:px-6 md:px-8 lg:py-16">
				<div class="mx-auto max-w-[1480px]">
					<header class="mb-6 flex flex-col justify-between gap-3 @4xl/main:flex-row @4xl/main:items-end">
						<div>
							<p class="m-0 mb-2 text-[12px] font-bold tracking-[0.16em] text-playstation-blue uppercase">Section 04 &middot; Cgroup controls</p>
							<h2 class="m-0 text-[clamp(26px,3.4vw,38px)] leading-tight font-light text-black">Prove how much the container can consume</h2>
						</div>
						<p class="m-0 max-w-xl text-[14.5px] leading-relaxed text-body-gray">
							CIS Docker Benchmark rules <strong>5.11</strong>, <strong>5.12</strong>, <strong>5.29</strong>. Tune inputs, run pressure, then read the live monitor while Dokuru applies <code>mem_limit</code>, <code>cpu_shares</code>, and <code>pids_limit</code>.
						</p>
					</header>

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
				</div>
			</section>

			<!-- Section 05 · Evidence -->
			<section id="evidence" class="scroll-mt-20 bg-white px-4 py-12 sm:px-6 md:px-8 lg:py-16">
				<div class="mx-auto max-w-[1480px]">
					<header class="mb-6 flex flex-col justify-between gap-3 @4xl/main:flex-row @4xl/main:items-end">
						<div>
							<p class="m-0 mb-2 text-[12px] font-bold tracking-[0.16em] text-playstation-blue uppercase">Section 05 &middot; Evidence</p>
							<h2 class="m-0 text-[clamp(26px,3.4vw,38px)] leading-tight font-light text-black">Side-by-side reference for the report</h2>
						</div>
						<p class="m-0 max-w-xl text-[14.5px] leading-relaxed text-body-gray">
							Screenshot crib sheet for the thesis defense. The container stays vulnerable; only the boundary changes.
						</p>
					</header>

					<div class="grid grid-cols-1 gap-4 @4xl/main:grid-cols-12">
						<RuntimeEvidencePanel
							{runtime}
							ok={Boolean(evidenceData?.ok)}
							onRefresh={() => refreshEvidence(true)}
							onProbe={runProbe}
							{running}
						/>
						<ProofChecklistPanel />
					</div>
				</div>
			</section>
		</main>

		<footer class="bg-playstation-blue px-4 py-7 text-sm text-white sm:px-6 md:px-8">
			<div class="mx-auto flex max-w-[1480px] flex-col justify-between gap-3 @3xl/page:flex-row @3xl/page:items-center">
				<strong class="text-base">Dokuru Namespace &amp; Cgroup Lab</strong>
				<span class="max-w-3xl text-white/85">
					Run only on a disposable lab host. Endpoints intentionally expose shell execution and resource pressure.
				</span>
			</div>
		</footer>
	</div>

	<!-- In-flow sidebar (lg+ only) -->
	{#if terminalOpen}
		<aside class="sticky top-0 hidden h-screen w-[360px] shrink-0 flex-col self-start border-l border-divider bg-black text-white lg:flex xl:w-[400px]">
			<TerminalDrawer
				lines={terminalLines}
				connected={terminalConnected}
				busy={terminalBusy}
				onClear={clearTerminal}
				onClose={closeTerminal}
			/>
		</aside>
	{/if}
</div>

<!-- Mobile / tablet overlay drawer (<lg) -->
{#if terminalOpen}
	<div class="fixed inset-0 z-40 flex lg:hidden">
		<button
			type="button"
			class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
			aria-label="Close terminal overlay"
			onclick={closeTerminal}
		></button>
		<div class="relative ml-auto flex h-screen w-full max-w-md flex-col bg-black text-white shadow-[-12px_0_30px_rgba(0,0,0,0.45)]">
			<TerminalDrawer
				lines={terminalLines}
				connected={terminalConnected}
				busy={terminalBusy}
				onClear={clearTerminal}
				onClose={closeTerminal}
			/>
		</div>
	</div>
{/if}
