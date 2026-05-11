<script lang="ts">
	import { onMount } from 'svelte';
	import ControlDeck from '$lib/components/organisms/ControlDeck.svelte';
	import HeroSection from '$lib/components/organisms/HeroSection.svelte';
	import Masthead from '$lib/components/organisms/Masthead.svelte';
	import TerminalEventLog, { type TerminalCompletion, type TerminalEvent } from '$lib/components/organisms/TerminalEventLog.svelte';
	import TerminalHandle from '$lib/components/organisms/TerminalHandle.svelte';
	import SidebarMonitor from '$lib/components/organisms/SidebarMonitor.svelte';
	import { Activity, AlertOctagon, FlaskConical, Terminal as TerminalIcon } from '@lucide/svelte';
	import type {
		ActivePayload,
		CommandPreset,
		CustomerSample,
		LabResponse,
		RuntimeEvidence
	} from '$lib/types/lab';

	type LabRoute = 'home' | 'monitor' | 'namespace' | 'exploit' | 'cgroup' | 'evidence';
	type UiTheme = 'dark' | 'light';
	type ActionState = 'running' | 'success' | 'error';
	type ActionStatus = {
		state: ActionState;
		label: string;
		at: string;
		detail?: string;
	};
	type Props = {
		page?: LabRoute;
	};

	let { page = 'home' }: Props = $props();

	let uiTheme = $state<UiTheme>('dark');
	let pingHost = $state('127.0.0.1; id; cat /proc/self/uid_map; cat /sys/fs/cgroup/memory.max');
	let command = $state('id; cat /proc/self/uid_map; cat /proc/self/gid_map');
	let pidCount = $state(120);
	let memoryMb = $state(3072);
	let cpuSeconds = $state(35);
	let running = $state('');
	let httpRunning = $state('');
	let evidenceData = $state<LabResponse | null>(null);
	let lastUpdated = $state('');
	let actionStatuses = $state<Record<string, ActionStatus>>({});
	let events = $state<TerminalEvent[]>([]);
	let customerSamples = $state<CustomerSample[]>([]);
	let activePayload = $state<ActivePayload | null>(null);
	let activeShellEventId = $state<string | null>(null);
	let activeActionType = $state<string | null>(null);
	let pendingShellCommand = $state('');
	let hostname = $state('');
	let terminalConnected = $state(false);
	let monitorConnected = $state(false);
	let customerConnected = $state(false);
	let terminalOpen = $state(false);
	let terminalWidth = $state(420);
	let terminalMaxWidth = $state(720);
	let terminalResizing = $state(false);
	type SidebarPanel = 'terminal' | 'monitor';
	type SnapZone = 'top' | 'bottom' | 'left' | 'right' | 'replace';
	let activePanels = $state<SidebarPanel[]>(['terminal']);
	let splitRatio = $state(0.5);
	let splitDir = $state<'horizontal' | 'vertical'>('vertical');
	let splitDragging = $state(false);
	let splitContainerEl = $state<HTMLDivElement | null>(null);
	let draggingPanel = $state<SidebarPanel | null>(null);
	let dragHoverZone = $state<SnapZone | null>(null);
	const completionRequests = new Map<string, (completion: TerminalCompletion | null) => void>();

	function onSplitPointerDown(event: PointerEvent) {
		event.preventDefault();
		splitDragging = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}
	function onSplitPointerMove(event: PointerEvent) {
		if (!splitDragging || !splitContainerEl) return;
		const rect = splitContainerEl.getBoundingClientRect();
		const r =
			splitDir === 'horizontal'
				? (event.clientX - rect.left) / rect.width
				: (event.clientY - rect.top) / rect.height;
		splitRatio = Math.max(0.18, Math.min(0.82, r));
	}
	function onSplitPointerUp(event: PointerEvent) {
		splitDragging = false;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
	}

	function togglePanel(panel: SidebarPanel) {
		if (activePanels.includes(panel)) {
			activePanels = activePanels.filter((p) => p !== panel);
		} else if (activePanels.length === 0) {
			activePanels = [panel];
		} else {
			splitDir = 'vertical';
			activePanels = [...activePanels, panel];
		}
	}

	function removePanel(panel: SidebarPanel) {
		activePanels = activePanels.filter((p) => p !== panel);
	}

	function detectZone(event: DragEvent, target: HTMLElement): SnapZone {
		const r = target.getBoundingClientRect();
		const x = (event.clientX - r.left) / r.width;
		const y = (event.clientY - r.top) / r.height;
		const dx = Math.min(x, 1 - x);
		const dy = Math.min(y, 1 - y);
		if (dx < dy) return x < 0.5 ? 'left' : 'right';
		return y < 0.5 ? 'top' : 'bottom';
	}

	function onDropZoneDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		const target = event.currentTarget as HTMLElement;
		if (activePanels.length === 0) {
			dragHoverZone = 'replace';
		} else {
			dragHoverZone = detectZone(event, target);
		}
	}
	function onDropZoneLeave(event: DragEvent) {
		const related = event.relatedTarget as Node | null;
		const current = event.currentTarget as HTMLElement;
		if (related && current.contains(related)) return;
		dragHoverZone = null;
	}
	function onDropZoneDrop(event: DragEvent) {
		event.preventDefault();
		const panel = event.dataTransfer?.getData('text/plain') as SidebarPanel;
		const zone = dragHoverZone;
		dragHoverZone = null;
		draggingPanel = null;
		if (panel === 'terminal' || panel === 'monitor') placePanel(panel, zone);
	}
	function placePanel(panel: SidebarPanel, zone: SnapZone | null) {
		const others = activePanels.filter((p) => p !== panel);
		if (others.length === 0) {
			activePanels = [panel];
			return;
		}
		if (zone === 'left') {
			splitDir = 'horizontal';
			activePanels = [panel, others[0]];
		} else if (zone === 'right') {
			splitDir = 'horizontal';
			activePanels = [others[0], panel];
		} else if (zone === 'top') {
			splitDir = 'vertical';
			activePanels = [panel, others[0]];
		} else {
			splitDir = 'vertical';
			activePanels = [others[0], panel];
		}
	}

	function panelLabel(panel: SidebarPanel): string {
		return panel === 'terminal' ? 'Terminal' : 'Monitor';
	}
	function panelDot(panel: SidebarPanel): string {
		if (panel === 'terminal') {
			return terminalConnected
				? terminalBusy
					? 'bg-playstation-cyan'
					: 'bg-emerald-400'
				: 'bg-white/20';
		}
		return monitorConnected ? 'bg-emerald-400' : 'bg-white/20';
	}
	let terminalSocket: WebSocket | null = null;
	let monitorSocket: WebSocket | null = null;
	let customerSocket: WebSocket | null = null;
	let mounted = false;

	const TERMINAL_MIN_WIDTH = 320;
	const TERMINAL_MAX_WIDTH_RATIO = 0.75;
	const TERMINAL_WIDTH_KEY = 'dokuru-lab.terminal.width';
	const TERMINAL_OPEN_KEY = 'dokuru-lab.terminal.open';

	const presets: CommandPreset[] = [
		{ label: 'Root map', command: 'id; cat /proc/self/uid_map; cat /proc/self/gid_map' },
		{ label: 'PID view', command: 'ps -eo pid,ppid,user,comm | head -40' },
		{
			label: 'Root/PID IDs',
			command: 'readlink /proc/self/ns/user; readlink /proc/self/ns/pid; readlink /proc/1/ns/pid'
		}
	];

	const runtime = $derived(evidenceData?.runtime as RuntimeEvidence | undefined);
	const terminalBusy = $derived(Boolean(running || httpRunning));
	const runtimeLabel = $derived(runtimeStateLabel(runtime?.uid_map));
	const payloadActions = new Set(['pid-bomb', 'memory-bomb', 'cpu-burn', 'cpu-blast', 'sabotage-proxy']);
	const stopActions = new Set(['cleanup', 'stop-payloads']);
	const actionLabels: Record<string, string> = {
		health: 'Container health',
		probe: 'Probe write',
		exec: 'Root-map command',
		ping: 'Command injection',
		upload: 'Bind marker',
		'suid-trap': 'SUID trap',
		'setcap-trap': 'Setcap trap',
		'cleanup-traps': 'Cleanup traps',
		'pid-bomb': 'PID bomb',
		'memory-bomb': 'Memory pressure',
		'cpu-burn': 'CPU burn',
		'cpu-blast': 'CPU blast',
		'customer-probe': 'Customer probe',
		'dump': 'Dump app data',
		ransomware: 'Ransomware demo',
		restore: 'Restore data',
		cleanup: 'Cleanup payloads',
		'stop-payloads': 'Stop payloads'
	};
	const THEME_KEY = 'dokuru-lab.theme';

	onMount(() => {
		mounted = true;
		hostname = window.location.host;
		restoreUiTheme();
		updateTerminalMaxWidth();
		window.addEventListener('resize', updateTerminalMaxWidth);
		restoreTerminalState();
		connectMonitor();
		connectTerminal();
		connectCustomer();
		void refreshEvidence(true);
		if (page !== 'home') window.setTimeout(scrollControlDeck, 80);
		return () => {
			mounted = false;
			terminalSocket?.close();
			monitorSocket?.close();
			customerSocket?.close();
			window.removeEventListener('resize', updateTerminalMaxWidth);
		};
	});

	$effect(() => {
		if (!mounted || page === 'home') return;
		window.setTimeout(scrollControlDeck, 0);
	});

	function scrollControlDeck() {
		document.getElementById('control-deck')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function restoreUiTheme() {
		try {
			const stored = window.localStorage.getItem(THEME_KEY);
			if (stored === 'dark' || stored === 'light') uiTheme = stored;
		} catch {
			/* localStorage unavailable */
		}
	}

	function toggleTheme() {
		uiTheme = uiTheme === 'dark' ? 'light' : 'dark';
		try {
			window.localStorage.setItem(THEME_KEY, uiTheme);
		} catch {
			/* ignore */
		}
	}

	function updateTerminalMaxWidth() {
		terminalMaxWidth = Math.max(TERMINAL_MIN_WIDTH, Math.floor(window.innerWidth * TERMINAL_MAX_WIDTH_RATIO));
		terminalWidth = Math.max(TERMINAL_MIN_WIDTH, Math.min(terminalMaxWidth, terminalWidth));
	}

	function restoreTerminalState() {
		try {
			const storedWidth = window.localStorage.getItem(TERMINAL_WIDTH_KEY);
			if (storedWidth) {
				const parsed = Number(storedWidth);
				if (Number.isFinite(parsed)) {
					terminalWidth = Math.max(TERMINAL_MIN_WIDTH, Math.min(terminalMaxWidth, parsed));
				}
			}
			// Sidebar now defaults to closed on load to prevent intrusive auto-opening
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

	function openSidebarPanel(panel: SidebarPanel = 'terminal') {
		terminalOpen = true;
		if (!activePanels.includes(panel)) {
			activePanels = activePanels.length === 0 ? [panel] : [panel, ...activePanels].slice(0, 2);
		}
		try {
			window.localStorage.setItem(TERMINAL_OPEN_KEY, 'true');
		} catch {
			/* ignore */
		}
	}

	function openTerminal() {
		openSidebarPanel('terminal');
	}

	function openMonitorPanel() {
		openSidebarPanel('monitor');
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
		terminalWidth = Math.max(TERMINAL_MIN_WIDTH, Math.min(terminalMaxWidth, next));
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
		terminalSocket.onopen = () => {
			terminalConnected = true;
			appendSystemEvent('connected to terminal websocket');
		};
		terminalSocket.onmessage = (event) => {
			const message = parseSocketMessage(event.data);
			if (!message) return;

			if (message.type === 'terminal.complete') {
				resolveTerminalCompletion(message);
				return;
			}

			if (message.type === 'terminal.payload') {
				activePayload = normalizeActivePayload(message.payload);
				return;
			}

			if (message.type === 'terminal.line') {
				appendShellLine(message.stream as 'stdout' | 'stderr' | 'stdin' | 'system', String(message.text || ''));
			}

			if (message.type === 'terminal.start') {
				const action = String(message.action || 'terminal');
				running = action;
				activeActionType = action;
				startShellEvent(action);
				markAction(action, 'running');
			}

			if (message.type === 'terminal.exit') {
				const action = String(message.action || activeActionType || running || 'terminal');
				const code = Number(message.code ?? 0);
				finishShellEvent(Number.isFinite(code) ? code : null);
				markAction(action, code === 0 ? 'success' : 'error');
				running = '';
				activeActionType = null;
				void refreshEvidence(false);
			}
		};
		terminalSocket.onclose = () => {
			terminalConnected = false;
			running = '';
			activeActionType = null;
			finishShellEvent(null);
			appendSystemEvent('terminal websocket disconnected', 'warn');
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
		if (showLoading) {
			running = 'health';
			markAction('health', 'running');
		}
		const result = await requestJson('/api/evidence');
		evidenceData = result;
		lastUpdated = new Date().toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		if (showLoading) {
			markAction('health', result.ok ? 'success' : 'error');
			running = '';
		}
	}

	async function runProbe() {
		sendTerminal({ type: 'probe' });
	}

	function runExec() {
		sendTerminal({ type: 'exec', command });
	}

	function runPidBomb() {
		sendTerminal({ type: 'pid-bomb', count: pidCount });
	}

	function runMemoryBomb() {
		sendTerminal({ type: 'memory-bomb', mb: memoryMb });
	}

	function runCpuBlast() {
		sendTerminal({ type: 'cpu-blast', seconds: cpuSeconds });
	}

	function runCustomerProbe() {
		sendTerminal({ type: 'customer-probe' });
	}

	function stopActivePayload() {
		sendTerminal({ type: 'stop-payloads' });
	}

	async function runUploadOwnershipProof() {
		const payload = [
			'Dokuru ownership marker',
			`created_at=${new Date().toISOString()}`,
			'purpose=container-root-bind-mount-proof',
			''
		].join('\n');

		const form = new FormData();
		form.set('file', new File([payload], 'ownership-proof.txt', { type: 'text/plain' }));
		await runHttpAction('upload', '/api/upload', { method: 'POST', body: form });
	}

	async function runSuidTrap() {
		await runHttpAction('suid-trap', '/api/exploit/suid-trap', { method: 'POST' });
	}

	async function runSetcapTrap() {
		await runHttpAction('setcap-trap', '/api/exploit/setcap-trap', { method: 'POST' });
	}

	async function runCleanupTraps() {
		await runHttpAction('cleanup-traps', '/api/exploit/cleanup-traps', { method: 'POST' });
	}

	async function runCommandInjection() {
		await runHttpAction('ping', `/api/ping?host=${encodeURIComponent(pingHost)}`);
	}

	async function dumpAppData() {
		await runHttpAction('dump', '/api/demo/dump', { method: 'POST' });
	}

	async function runRansomware() {
		await runHttpAction('ransomware', '/api/exploit/ransomware', { method: 'POST' });
	}

	async function restoreDemoData() {
		await runHttpAction('restore', '/api/demo/reset', { method: 'POST' });
	}

	async function runHttpAction(key: string, path: string, options: RequestInit = {}) {
		if (running || httpRunning) {
			appendSystemEvent(`busy running ${running || httpRunning}; wait before starting ${actionLabels[key] || key}`, 'error');
			markAction(key, 'error', 'busy');
			openTerminal();
			return;
		}

		openTerminal();
		httpRunning = key;
		markAction(key, 'running');
		const method = String(options.method || 'GET').toUpperCase();
		const eventId = createEventId('http');
		const startedAt = performance.now();
		const httpEvent: TerminalEvent = {
			id: eventId,
			at: timeLabel(),
			kind: 'http',
			method,
			path,
			body: options.body instanceof FormData ? '[multipart/form-data]' : options.body
		};
		events = [...events, httpEvent].slice(-200);

		try {
			const result = await requestJson(path, options);
			const duration = Math.round(performance.now() - startedAt);
			events = events.map((event) =>
				event.id === eventId && event.kind === 'http'
					? { ...event, status: Number(result.http_status || 0) || undefined, duration, response: result }
					: event
			);
			markAction(key, result.ok ? 'success' : 'error', `${result.http_status || 'n/a'}`);
			void refreshEvidence(false);
		} catch (error) {
			const duration = Math.round(performance.now() - startedAt);
			const message = error instanceof Error ? error.message : String(error);
			events = events.map((event) =>
				event.id === eventId && event.kind === 'http' ? { ...event, duration, error: message } : event
			);
			markAction(key, 'error', message);
		} finally {
			httpRunning = '';
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

	function sendTerminal(payload: Record<string, unknown>) {
		const action = String(payload.type || 'terminal');
		openTerminal();

		if (!stopActions.has(action) && (running || httpRunning)) {
			appendSystemEvent(`terminal is busy running ${running || httpRunning}`, 'error');
			markAction(action, 'error', 'busy');
			return;
		}

		if (!stopActions.has(action) && activePayload && payloadActions.has(action)) {
			appendSystemEvent(`${activePayload.label} is still active; stop it before starting another payload`, 'error');
			markAction(action, 'error', 'payload-active');
			return;
		}

		if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) {
			appendSystemEvent('terminal websocket is not connected', 'error');
			markAction(action, 'error', 'websocket-offline');
			return;
		}

		running = action;
		pendingShellCommand = action === 'exec' ? String(payload.command || command) : `dokuru-lab ${action}`;
		markAction(action, 'running');
		terminalSocket.send(JSON.stringify(payload));
	}

	function sendShellInput(text: string) {
		if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) {
			appendSystemEvent('terminal websocket is not connected', 'error');
			return;
		}

		if (activeShellEventId) {
			terminalSocket.send(JSON.stringify({ type: 'stdin', data: `${text}\n` }));
			return;
		}

		sendTerminal({ type: 'exec', command: text });
	}

	function requestTerminalCompletion(input: string, cursor: number): Promise<TerminalCompletion | null> {
		if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) return Promise.resolve(null);

		const requestId = createEventId('complete');
		return new Promise((resolve) => {
			const timeout = window.setTimeout(() => {
				completionRequests.delete(requestId);
				resolve(null);
			}, 700);

			completionRequests.set(requestId, (completion) => {
				window.clearTimeout(timeout);
				resolve(completion);
			});

			terminalSocket?.send(JSON.stringify({ type: 'complete', requestId, command: input, cursor }));
		});
	}

	function resolveTerminalCompletion(message: Record<string, unknown>) {
		const requestId = String(message.requestId || '');
		const resolve = completionRequests.get(requestId);
		if (!resolve) return;
		completionRequests.delete(requestId);

		resolve({
			replacement: typeof message.replacement === 'string' ? message.replacement : undefined,
			options: Array.isArray(message.options) ? message.options.map(String) : undefined
		});
	}

	function clearEvents() {
		events = [];
		activeShellEventId = null;
	}

	function createEventId(prefix: string): string {
		return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}

	function appendSystemEvent(text: string, level: 'info' | 'warn' | 'error' = 'info') {
		const trimmed = text.trim();
		if (!trimmed) return;
		const event: TerminalEvent = {
			id: createEventId('sys'),
			at: timeLabel(),
			kind: 'system',
			text: trimmed,
			level
		};
		events = [...events, event].slice(-200);
	}

	function startShellEvent(action: string) {
		const id = createEventId('sh');
		activeShellEventId = id;
		const event: TerminalEvent = {
			id,
			at: timeLabel(),
			kind: 'shell',
			command: pendingShellCommand || (action === 'exec' ? command : `dokuru-lab ${action}`),
			lines: [],
			running: true
		};
		events = [...events, event].slice(-200);
	}

	function appendShellLine(stream: 'stdout' | 'stderr' | 'stdin' | 'system', text: string) {
		if (!activeShellEventId) {
			if (stream !== 'system' && stream !== 'stderr') return;
			appendSystemEvent(text, stream === 'stderr' ? 'error' : 'info');
			return;
		}

		events = events.map((event) =>
			event.id === activeShellEventId && event.kind === 'shell'
				? { ...event, lines: [...event.lines.slice(-400), { stream, text }] }
				: event
		);
	}

	function finishShellEvent(exitCode: number | null) {
		if (!activeShellEventId) return;
		events = events.map((event) =>
			event.id === activeShellEventId && event.kind === 'shell'
				? { ...event, running: false, exitCode }
				: event
		);
		activeShellEventId = null;
		pendingShellCommand = '';
	}

	function markAction(key: string, state: ActionState, detail?: string) {
		actionStatuses = {
			...actionStatuses,
			[key]: {
				state,
				label: actionLabels[key] || key,
				at: timeLabel(),
				detail
			}
		};
	}

	function runtimeStateLabel(uidMap?: string): string {
		const first = uidMap?.split('\n')[0]?.trim();
		if (!first) return 'root map loading';
		if (first.startsWith('0 0 ')) return 'root = host root';
		if (first.startsWith('0 100000 ') || first.includes(' 100000 ')) return 'root remapped';
		return 'runtime · live';
	}

	function parseSocketMessage(value: unknown): Record<string, unknown> | null {
		try {
			return JSON.parse(String(value)) as Record<string, unknown>;
		} catch {
			return null;
		}
	}

	function normalizeActivePayload(value: unknown): ActivePayload | null {
		if (!value || typeof value !== 'object') return null;
		const payload = value as Record<string, unknown>;
		const type = String(payload.type || '');
		if (!type) return null;

		const normalized: ActivePayload = {
			type,
			label: String(payload.label || type),
			startedAt: String(payload.startedAt || new Date().toISOString())
		};

		if (payload.expiresAt) normalized.expiresAt = String(payload.expiresAt);
		return normalized;
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

<div class={`flex min-h-screen ${uiTheme === 'dark' ? 'bg-black text-white' : 'bg-white text-ink'}`}>
	<!-- Main column -->
	<div class="@container/page flex min-w-0 flex-1 flex-col">
		<Masthead
			{monitorConnected}
			monitorLastUpdated={lastUpdated}
			theme={uiTheme}
			{runtimeLabel}
			onThemeToggle={toggleTheme}
		/>

		<main class="@container/main flex flex-1 flex-col">
			<HeroSection
				{monitorConnected}
				{terminalConnected}
				{customerConnected}
				theme={uiTheme}
				onProbe={runProbe}
				running={running || httpRunning}
			/>

			<ControlDeck
				{page}
				theme={uiTheme}
				{pingHost}
				{command}
				{presets}
				{pidCount}
				{memoryMb}
				{cpuSeconds}
				busy={terminalBusy}
				{running}
				{activePayload}
				{runtime}
				evidenceOk={Boolean(evidenceData?.ok)}
				{lastUpdated}
				{terminalConnected}
				{monitorConnected}
				{customerConnected}
				{customerSamples}
				{actionStatuses}
				onPingHostChange={(value) => (pingHost = value)}
				onCommandChange={(value) => (command = value)}
				onPidCountChange={(value) => (pidCount = value)}
				onMemoryChange={(value) => (memoryMb = value)}
				onCpuChange={(value) => (cpuSeconds = value)}
				onRunInjection={runCommandInjection}
				onRunCommand={runExec}
				onUploadMarker={runUploadOwnershipProof}
				onSuidTrap={runSuidTrap}
				onSetcapTrap={runSetcapTrap}
				onCleanupTraps={runCleanupTraps}
				onPidBomb={runPidBomb}
				onMemoryBomb={runMemoryBomb}
				onCpuBlast={runCpuBlast}
				onStopPayloads={stopActivePayload}
				onCustomerProbe={runCustomerProbe}
				onDumpData={dumpAppData}
				onRansomware={runRansomware}
				onRestoreData={restoreDemoData}
				onRefreshEvidence={() => refreshEvidence(true)}
				onProbeWrite={runProbe}
				onOpenTerminal={openTerminal}
				onOpenMonitor={openMonitorPanel}
			/>
		</main>

		<footer class="bg-playstation-blue px-4 py-7 text-sm text-white sm:px-6 md:px-8">
			<div class="mx-auto flex max-w-[1480px] flex-col justify-between gap-4 @3xl/page:flex-row @3xl/page:items-center">
				<div class="flex items-center gap-2.5">
					<span class="grid h-8 w-8 place-items-center rounded-full bg-white text-playstation-blue" aria-hidden="true">
						<FlaskConical size={18} strokeWidth={1.5} />
					</span>
					<strong class="text-[15px] font-semibold">Dokuru Root Map &amp; Resource Lab</strong>
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
			<div class="flex h-8 shrink-0 items-center gap-1 border-b border-white/[0.07] px-4">
				<!-- Draggable Lego Blocks -->
				<div class="flex items-center gap-1.5">
					{#each ['terminal', 'monitor'] as SidebarPanel[] as panel}
						{@const active = activePanels.includes(panel)}
						<button
							type="button"
							draggable="true"
							ondragstart={(e) => {
								if (e.dataTransfer) {
									e.dataTransfer.setData('text/plain', panel);
									e.dataTransfer.effectAllowed = 'move';
								}
								draggingPanel = panel;
							}}
							ondragend={() => {
								draggingPanel = null;
								dragHoverZone = null;
							}}
							onclick={() => togglePanel(panel)}
							style="font-size: 11px;"
							class="group flex cursor-grab items-center gap-1.5 rounded-[5px] border px-2 py-0.5 font-medium tracking-tight transition-all active:cursor-grabbing {active
								? 'border-white/10 bg-white/[0.08] text-white shadow-sm'
								: 'border-transparent text-white/45 hover:bg-white/[0.04] hover:text-white/80'}"
							title={active ? 'Click to remove · drag to reposition' : 'Click to add · drag to position'}
						>
							{#if panel === 'terminal'}
								<TerminalIcon size={12} strokeWidth={1.8} />
							{:else}
								<Activity size={12} strokeWidth={1.8} />
							{/if}
							<span>{panelLabel(panel)}</span>
							<span class={`ml-0.5 inline-block h-[3px] w-[3px] rounded-full ${panelDot(panel)}`} aria-hidden="true"></span>
						</button>
					{/each}
				</div>

				<!-- Lines count pill -->
				{#if events.length > 0 && activePanels.includes('terminal')}
					<span class="ml-1 rounded-full bg-white/[0.06] px-1.5 py-px font-mono text-[9.5px] text-white/45 tabular-nums">
						{events.length > 999 ? '999+' : events.length}
					</span>
				{/if}
			</div>

			<!-- ── Sidebar content ───────────────────────────────── -->
			<div
				class="relative flex min-h-0 flex-1 flex-col overflow-hidden"
				role="region"
				aria-label="Panel drop zone"
				ondragover={onDropZoneDragOver}
				ondragleave={onDropZoneLeave}
				ondrop={onDropZoneDrop}
			>
				{#if activePanels.length === 0}
					<div class="m-3 flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/[0.015] text-white/30">
						<div class="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/35">
							<TerminalIcon size={13} strokeWidth={1.6} />
						</div>
						<p class="m-0 text-[11px] tracking-tight text-white/45">Drop a component here</p>
						<p class="m-0 font-mono text-[9.5px] tracking-[0.04em] text-white/25">terminal · monitor</p>
					</div>
				{:else if activePanels.length === 1}
					<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
						{#if activePanels[0] === 'terminal'}
							<TerminalEventLog
								{events}
								connected={terminalConnected}
								running={terminalBusy}
								onClear={clearEvents}
								onClose={() => removePanel('terminal')}
								onSend={sendShellInput}
								onComplete={requestTerminalCompletion}
								{hostname}
							/>
						{:else}
							<SidebarMonitor {runtime} connected={monitorConnected} {lastUpdated} onClose={() => removePanel('monitor')} />
						{/if}
					</div>
				{:else}
					<!-- Split layout with draggable divider (vertical or horizontal) -->
					<div
						bind:this={splitContainerEl}
						class="flex min-h-0 flex-1 overflow-hidden {splitDir === 'horizontal' ? 'flex-row' : 'flex-col'}"
					>
						<!-- First panel (top or left) -->
						<div
							style={splitDir === 'horizontal'
								? `width: ${splitRatio * 100}%`
								: `height: ${splitRatio * 100}%`}
							class="group/pane relative flex min-h-0 flex-col overflow-hidden"
						>
							{#if activePanels[0] === 'terminal'}
								<TerminalEventLog
									{events}
									connected={terminalConnected}
									running={terminalBusy}
									onClear={clearEvents}
									onClose={() => removePanel('terminal')}
									onSend={sendShellInput}
									onComplete={requestTerminalCompletion}
									{hostname}
								/>
							{:else}
								<SidebarMonitor {runtime} connected={monitorConnected} {lastUpdated} onClose={() => removePanel('monitor')} />
							{/if}
						</div>
						<!-- Drag divider -->
						<div
							role="separator"
							aria-label="Drag to resize panels"
							class="group relative z-10 shrink-0 bg-white/[0.05] transition-colors hover:bg-white/[0.18] {splitDragging
								? 'bg-playstation-blue/40'
								: ''} {splitDir === 'horizontal' ? 'w-[4px] cursor-col-resize' : 'h-[4px] cursor-row-resize'}"
							onpointerdown={onSplitPointerDown}
							onpointermove={onSplitPointerMove}
							onpointerup={onSplitPointerUp}
							onpointercancel={onSplitPointerUp}
						>
							<div
								class="absolute rounded-full bg-white/20 opacity-0 transition-opacity group-hover:opacity-100 {splitDir ===
								'horizontal'
									? 'inset-y-0 left-1/2 my-auto h-8 w-[2px] -translate-x-1/2'
									: 'inset-x-0 top-1/2 mx-auto h-[2px] w-8 -translate-y-1/2'}"
							></div>
						</div>
						<!-- Second panel (bottom or right) -->
						<div class="group/pane relative flex min-h-0 flex-1 flex-col overflow-hidden">
							{#if activePanels[1] === 'terminal'}
								<TerminalEventLog
									{events}
									connected={terminalConnected}
									running={terminalBusy}
									onClear={clearEvents}
									onClose={() => removePanel('terminal')}
									onSend={sendShellInput}
									onComplete={requestTerminalCompletion}
									{hostname}
								/>
							{:else}
								<SidebarMonitor {runtime} connected={monitorConnected} {lastUpdated} onClose={() => removePanel('monitor')} />
							{/if}
						</div>
					</div>
				{/if}

				<!-- Snap-zone preview overlay (during drag) -->
				{#if draggingPanel && dragHoverZone}
					<div
						class="pointer-events-none absolute z-20 border border-playstation-blue/55 bg-playstation-blue/15 backdrop-blur-[1px] transition-[top,left,right,bottom,width,height] duration-150 ease-out"
						style={dragHoverZone === 'top'
							? 'top:0;left:0;right:0;height:50%;'
							: dragHoverZone === 'bottom'
								? 'bottom:0;left:0;right:0;height:50%;'
								: dragHoverZone === 'left'
									? 'top:0;bottom:0;left:0;width:50%;'
									: dragHoverZone === 'right'
										? 'top:0;bottom:0;right:0;width:50%;'
										: 'inset:0;'}
					>
						<div class="grid h-full w-full place-items-center">
							<span class="rounded bg-black/55 px-2 py-1 font-mono text-[10px] tracking-tight text-white/85">
								{dragHoverZone === 'replace' ? 'place here' : `snap ${dragHoverZone}`}
							</span>
						</div>
					</div>
				{/if}
			</div>

		</div>
	</aside>
</div>

<!-- Desktop resize/toggle handle -->
<TerminalHandle
	open={terminalOpen}
	width={terminalWidth}
	minWidth={TERMINAL_MIN_WIDTH}
	maxWidth={terminalMaxWidth}
	connected={terminalConnected}
	busy={terminalBusy}
	lineCount={events.length}
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
			<TerminalEventLog
				{events}
				connected={terminalConnected}
				running={terminalBusy}
				onClear={clearEvents}
				onClose={closeTerminal}
				onSend={sendShellInput}
				onComplete={requestTerminalCompletion}
				{hostname}
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
		{#if events.length > 0}
			<span class="ml-1 rounded-full bg-white/20 px-2 py-0.5 font-mono text-[11px] text-white">{events.length > 99 ? '99+' : events.length}</span>
		{/if}
	</button>
{/if}
