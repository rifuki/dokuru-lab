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
	import TerminalHandle from '$lib/components/organisms/TerminalHandle.svelte';
	import SidebarMonitor from '$lib/components/organisms/SidebarMonitor.svelte';
	import type { TerminalLine } from '$lib/components/organisms/TerminalPanel.svelte';
	import { Activity, AlertOctagon, Bomb, FileSearch, FlaskConical, Layers, SlidersHorizontal } from '@lucide/svelte';
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
	let terminalWidth = $state(420);
	let terminalResizing = $state(false);
	type SidebarMode = 'terminal' | 'monitor' | 'split-tm' | 'split-mt';
	let sidebarMode = $state<SidebarMode>('terminal');
	let splitRatio = $state(0.5);
	let splitDragging = $state(false);
	let splitContainerEl = $state<HTMLDivElement | null>(null);

	function onSplitPointerDown(event: PointerEvent) {
		event.preventDefault();
		splitDragging = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}
	function onSplitPointerMove(event: PointerEvent) {
		if (!splitDragging || !splitContainerEl) return;
		const rect = splitContainerEl.getBoundingClientRect();
		const r = (event.clientY - rect.top) / rect.height;
		splitRatio = Math.max(0.18, Math.min(0.82, r));
	}
	function onSplitPointerUp(event: PointerEvent) {
		splitDragging = false;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
	}
	let terminalSocket: WebSocket | null = null;
	let monitorSocket: WebSocket | null = null;
	let customerSocket: WebSocket | null = null;
	let mounted = false;

	const TERMINAL_MIN_WIDTH = 320;
	const TERMINAL_MAX_WIDTH = 720;
	const TERMINAL_WIDTH_KEY = 'dokuru-lab.terminal.width';
	const TERMINAL_OPEN_KEY = 'dokuru-lab.terminal.open';

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
		restoreTerminalState();
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

	function restoreTerminalState() {
		try {
			const storedWidth = window.localStorage.getItem(TERMINAL_WIDTH_KEY);
			if (storedWidth) {
				const parsed = Number(storedWidth);
				if (Number.isFinite(parsed)) {
					terminalWidth = Math.max(TERMINAL_MIN_WIDTH, Math.min(TERMINAL_MAX_WIDTH, parsed));
				}
			}
			const storedOpen = window.localStorage.getItem(TERMINAL_OPEN_KEY);
			if (storedOpen === 'true' && window.innerWidth >= 1024) {
				terminalOpen = true;
			}
		} catch {
			/* localStorage unavailable */
		}
	}

	function toggleTerminal() {
		terminalOpen = !terminalOpen;
		try {
			window.localStorage.setItem(TERMINAL_OPEN_KEY, String(terminalOpen));
		} catch {
			/* ignore */
		}
	}

	function closeTerminal() {
		if (!terminalOpen) return;
		terminalOpen = false;
		try {
			window.localStorage.setItem(TERMINAL_OPEN_KEY, 'false');
		} catch {
			/* ignore */
		}
	}

	function handleTerminalResize(next: number) {
		terminalResizing = true;
		terminalWidth = next;
	}

	function handleTerminalResizeEnd() {
		terminalResizing = false;
		try {
			window.localStorage.setItem(TERMINAL_WIDTH_KEY, String(terminalWidth));
		} catch {
			/* ignore */
		}
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
		<Masthead {monitorConnected} monitorLastUpdated={lastUpdated} />

		<main class="@container/main flex-1">
			<HeroSection
				{monitorConnected}
				{terminalConnected}
				{customerConnected}
				onProbe={runProbe}
				onRunCommand={runExec}
				{running}
			/>

			<!-- Section 01 · Live monitor -->
			<section id="monitor" class="scroll-mt-20 bg-white px-4 py-12 sm:px-6 md:px-8 lg:py-16">
				<div class="mx-auto max-w-[1480px]">
					<header class="mb-6 flex flex-col justify-between gap-3 @4xl/main:flex-row @4xl/main:items-end">
						<div>
							<p class="m-0 mb-2 inline-flex items-center gap-2 text-[13px] font-medium text-playstation-blue">
								<Activity size={18} strokeWidth={1.5} class="text-playstation-blue" />
								<span class="font-mono text-[11px] tabular-nums text-playstation-blue/70">01</span>
								<span class="text-[14px] uppercase tracking-[0.1em] text-playstation-blue">Live monitor</span>
							</p>
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
							<p class="m-0 mb-2 inline-flex items-center gap-2 text-[13px] font-medium text-playstation-blue">
								<Bomb size={18} strokeWidth={1.5} class="text-playstation-blue" />
								<span class="font-mono text-[11px] tabular-nums text-playstation-blue/70">02</span>
								<span class="text-[14px] uppercase tracking-[0.1em] text-playstation-blue">Blast radius</span>
							</p>
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
							<p class="m-0 mb-2 inline-flex items-center gap-2 text-[13px] font-medium text-playstation-blue">
								<Layers size={18} strokeWidth={1.5} class="text-playstation-blue" />
								<span class="font-mono text-[11px] tabular-nums text-playstation-blue/70">03</span>
								<span class="text-[14px] uppercase tracking-[0.1em] text-playstation-blue">Namespace isolation</span>
							</p>
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
							<p class="m-0 mb-2 inline-flex items-center gap-2 text-[13px] font-medium text-playstation-blue">
								<SlidersHorizontal size={18} strokeWidth={1.5} class="text-playstation-blue" />
								<span class="font-mono text-[11px] tabular-nums text-playstation-blue/70">04</span>
								<span class="text-[14px] uppercase tracking-[0.1em] text-playstation-blue">Cgroup controls</span>
							</p>
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
							<p class="m-0 mb-2 inline-flex items-center gap-2 text-[13px] font-medium text-playstation-blue">
								<FileSearch size={18} strokeWidth={1.5} class="text-playstation-blue" />
								<span class="font-mono text-[11px] tabular-nums text-playstation-blue/70">05</span>
								<span class="text-[14px] uppercase tracking-[0.1em] text-playstation-blue">Evidence</span>
							</p>
							<h2 class="m-0 text-[clamp(26px,3.4vw,38px)] leading-tight font-light text-black">Side-by-side reference for the report</h2>
						</div>
						<p class="m-0 max-w-xl text-[14.5px] leading-relaxed text-body-gray">
							Side-by-side comparison of container isolation. The application remains vulnerable, but the blast radius is strictly contained.
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
			<div class="mx-auto flex max-w-[1480px] flex-col justify-between gap-4 @3xl/page:flex-row @3xl/page:items-center">
				<div class="flex items-center gap-2.5">
					<span class="grid h-8 w-8 place-items-center rounded-full bg-white text-playstation-blue" aria-hidden="true">
						<FlaskConical size={18} strokeWidth={1.5} />
					</span>
					<strong class="text-[15px] font-semibold">Dokuru Namespace &amp; Cgroup Lab</strong>
				</div>
				<span class="flex max-w-3xl items-start gap-2 text-[13px] text-white/85">
					<AlertOctagon size={18} strokeWidth={1.5} class="mt-0.5 shrink-0" />
					<span>Run only on a disposable lab host. Endpoints intentionally expose shell execution and resource pressure.</span>
				</span>
			</div>
		</footer>
	</div>

	<!-- Always-rendered sidebar; width animates between 0 and terminalWidth -->
	<aside
		class="sticky top-0 hidden h-screen shrink-0 self-start overflow-hidden bg-black text-white lg:block"
		style="width: {terminalOpen ? terminalWidth : 0}px; transition: {terminalResizing
			? 'none'
			: 'width 220ms cubic-bezier(0.22, 1, 0.36, 1)'};"
		aria-hidden={!terminalOpen}
	>
		<div class="flex h-full flex-col" style="width: {terminalWidth}px;">

			<!-- ── Compact toolbar ────────────────────────────────── -->
			<div class="flex h-8 shrink-0 items-center gap-1 border-b border-white/[0.07] px-2">

				<!-- Connection status -->
				<span
					class="inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors {terminalConnected ? 'bg-emerald-400' : 'bg-commerce animate-pulse'}"
					title={terminalConnected ? 'Terminal connected' : 'Offline'}
				></span>

				<!-- Layout picker ──────────────────────────────────── -->
				<div class="ml-1.5 flex items-center gap-px rounded-md bg-white/[0.06] p-px">
					<!-- Terminal full -->
					<button
						type="button"
						onclick={() => sidebarMode = 'terminal'}
						title="Terminal only"
						class="grid h-[22px] w-[22px] cursor-pointer place-items-center rounded transition-colors {sidebarMode === 'terminal' ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/65'}"
					>
						<svg width="12" height="9" viewBox="0 0 12 9" fill="none">
							<rect width="12" height="9" rx="1.5" fill="currentColor" opacity=".55"/>
							<path d="M2.5 3.5l2 1.5-2 1.5" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
							<line x1="6" y1="6.5" x2="9.5" y2="6.5" stroke="black" stroke-width="0.8" opacity=".4"/>
						</svg>
					</button>
					<!-- Monitor full -->
					<button
						type="button"
						onclick={() => sidebarMode = 'monitor'}
						title="Monitor only"
						class="grid h-[22px] w-[22px] cursor-pointer place-items-center rounded transition-colors {sidebarMode === 'monitor' ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/65'}"
					>
						<svg width="12" height="9" viewBox="0 0 12 9" fill="none">
							<rect width="12" height="9" rx="1.5" fill="currentColor" opacity=".55"/>
							<circle cx="3" cy="3.8" r="1.3" fill="black" opacity=".5"/>
							<line x1="5.5" y1="3" x2="9.5" y2="3" stroke="black" stroke-width="0.8" opacity=".35"/>
							<line x1="5.5" y1="4.8" x2="9.5" y2="4.8" stroke="black" stroke-width="0.8" opacity=".35"/>
							<line x1="5.5" y1="6.5" x2="8" y2="6.5" stroke="black" stroke-width="0.8" opacity=".25"/>
						</svg>
					</button>
					<!-- Split: Terminal top, Monitor bottom -->
					<button
						type="button"
						onclick={() => sidebarMode = 'split-tm'}
						title="Terminal (top) + Monitor (bottom)"
						class="grid h-[22px] w-[22px] cursor-pointer place-items-center rounded transition-colors {sidebarMode === 'split-tm' ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/65'}"
					>
						<svg width="12" height="9" viewBox="0 0 12 9" fill="none">
							<rect width="12" height="4" rx="1.5" fill="currentColor" opacity=".4"/>
							<rect y="5" width="12" height="4" rx="1.5" fill="currentColor" opacity=".7"/>
						</svg>
					</button>
					<!-- Split: Monitor top, Terminal bottom -->
					<button
						type="button"
						onclick={() => sidebarMode = 'split-mt'}
						title="Monitor (top) + Terminal (bottom)"
						class="grid h-[22px] w-[22px] cursor-pointer place-items-center rounded transition-colors {sidebarMode === 'split-mt' ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/65'}"
					>
						<svg width="12" height="9" viewBox="0 0 12 9" fill="none">
							<rect width="12" height="4" rx="1.5" fill="currentColor" opacity=".7"/>
							<rect y="5" width="12" height="4" rx="1.5" fill="currentColor" opacity=".4"/>
						</svg>
					</button>
				</div>

				<!-- Lines count pill -->
				{#if terminalLines.length > 0 && (sidebarMode === 'terminal' || sidebarMode === 'split-tm' || sidebarMode === 'split-mt')}
					<span class="ml-1 rounded-full bg-white/10 px-1.5 py-px font-mono text-[9px] text-white/50 tabular-nums">{terminalLines.length > 999 ? '999+' : terminalLines.length}</span>
				{/if}

				<!-- Actions -->
				<div class="ml-auto flex items-center gap-0.5">
					<button
						type="button"
						onclick={clearTerminal}
						disabled={terminalLines.length === 0}
						title="Clear terminal"
						class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/35 transition-colors hover:bg-white/10 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-25"
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
					</button>
					<button
						type="button"
						onclick={closeTerminal}
						title="Close sidebar"
						class="grid h-6 w-6 cursor-pointer place-items-center rounded text-white/35 transition-colors hover:bg-white/10 hover:text-white/80"
					>
						<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>
					</button>
				</div>
			</div>

			<!-- ── Sidebar content ───────────────────────────────── -->
			{#if sidebarMode === 'terminal'}
				<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
					<TerminalDrawer
						lines={terminalLines}
						connected={terminalConnected}
						busy={terminalBusy}
						onClear={clearTerminal}
						onClose={closeTerminal}
						hideHeader
					/>
				</div>
			{:else if sidebarMode === 'monitor'}
				<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
					<SidebarMonitor {runtime} connected={monitorConnected} lastUpdated={lastUpdated} />
				</div>
			{:else}
				<!-- Split layout with draggable divider -->
				<div bind:this={splitContainerEl} class="flex min-h-0 flex-1 flex-col overflow-hidden">
					<!-- Top panel -->
					<div style="height: {splitRatio * 100}%" class="flex min-h-0 flex-col overflow-hidden">
						{#if sidebarMode === 'split-tm'}
							<TerminalDrawer lines={terminalLines} connected={terminalConnected} busy={terminalBusy} onClear={clearTerminal} onClose={closeTerminal} hideHeader />
						{:else}
							<SidebarMonitor {runtime} connected={monitorConnected} lastUpdated={lastUpdated} />
						{/if}
					</div>
					<!-- Drag divider -->
					<div
						role="separator"
						aria-label="Drag to resize panels"
						class="group relative z-10 h-[4px] shrink-0 cursor-row-resize bg-white/[0.05] transition-colors hover:bg-white/[0.18] {splitDragging ? 'bg-playstation-blue/40' : ''}"
						onpointerdown={onSplitPointerDown}
						onpointermove={onSplitPointerMove}
						onpointerup={onSplitPointerUp}
						onpointercancel={onSplitPointerUp}
					>
						<div class="absolute inset-x-0 top-1/2 mx-auto h-[2px] w-8 -translate-y-1/2 rounded-full bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
					</div>
					<!-- Bottom panel -->
					<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
						{#if sidebarMode === 'split-tm'}
							<SidebarMonitor {runtime} connected={monitorConnected} lastUpdated={lastUpdated} />
						{:else}
							<TerminalDrawer lines={terminalLines} connected={terminalConnected} busy={terminalBusy} onClear={clearTerminal} onClose={closeTerminal} hideHeader />
						{/if}
					</div>
				</div>
			{/if}

		</div>
	</aside>
</div>

<!-- Desktop resize/toggle handle -->
<TerminalHandle
	open={terminalOpen}
	width={terminalWidth}
	minWidth={TERMINAL_MIN_WIDTH}
	maxWidth={TERMINAL_MAX_WIDTH}
	connected={terminalConnected}
	busy={terminalBusy}
	lineCount={terminalLines.length}
	onToggle={toggleTerminal}
	onResize={handleTerminalResize}
	onResizeEnd={handleTerminalResizeEnd}
/>

<!-- Mobile / tablet overlay drawer (<lg) -->
{#if terminalOpen}
	<div class="fixed inset-0 z-40 flex lg:hidden">
		<button
			type="button"
			class="absolute inset-0 cursor-pointer bg-black/45 backdrop-blur-[2px]"
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

<!-- Mobile floating button (only on <lg, since handle is hidden) -->
{#if !terminalOpen}
	<button
		type="button"
		onclick={toggleTerminal}
		aria-label="Open terminal"
		class="fixed right-4 bottom-4 z-30 inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-playstation-blue px-5 py-3.5 text-[14px] font-medium text-white shadow-[0_5px_15px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-[1.05] hover:bg-[#1eaedb] hover:shadow-[0_8px_25px_rgba(30,174,219,0.3)] lg:hidden"
	>
		<span class={`inline-block h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${terminalConnected ? (terminalBusy ? 'bg-playstation-cyan animate-pulse' : 'bg-emerald-400') : 'bg-commerce'}`} aria-hidden="true"></span>
		<span class="tracking-wide">Terminal</span>
		{#if terminalLines.length > 0}
			<span class="ml-1 rounded-full bg-white/20 px-2 py-0.5 font-mono text-[11px] text-white">{terminalLines.length > 99 ? '99+' : terminalLines.length}</span>
		{/if}
	</button>
{/if}
