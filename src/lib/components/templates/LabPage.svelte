<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Activity,
		AlertOctagon,
		Bomb,
		Cpu,
		FlaskConical,
		Gauge,
		Hash,
		KeySquare,
		Layers,
		Lock,
		MemoryStick,
		Moon,
		Radio,
		ShieldAlert,
		Sun,
		ShoppingCart,
		Terminal as TerminalIcon,
		Upload,
		UserCog,
		Waves,
		Zap
	} from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import AttackCard from '$lib/components/molecules/AttackCard.svelte';
	import SignalCard from '$lib/components/molecules/SignalCard.svelte';
	import TerminalHandle from '$lib/components/organisms/TerminalHandle.svelte';
	import TerminalEventLog, {
		type TerminalEvent
	} from '$lib/components/organisms/TerminalEventLog.svelte';
	import type {
		ActivePayload,
		CustomerSample,
		LabResponse,
		RuntimeEvidence
	} from '$lib/types/lab';

	let running = $state('');
	let evidence = $state<RuntimeEvidence | undefined>();
	let lastUpdated = $state('');
	let customerSamples = $state<CustomerSample[]>([]);
	let activePayload = $state<ActivePayload | null>(null);
	let hostInfo = $state({ cpu_cores: 0, cpu_usage_percent: 0, memory_total_gb: 0, memory_available_gb: 0 });

	let terminalConnected = $state(false);
	let monitorConnected = $state(false);
	let customerConnected = $state(false);
	let terminalOpen = $state(false);
	let lightMode = $state(false);
	let terminalWidth = $state(480);
	let terminalMaxWidth = $state(840);
	let terminalResizing = $state(false);

	let events = $state<TerminalEvent[]>([]);
	let pidCount = $state(120);
	let memoryMb = $state(3072);
	let cpuSeconds = $state(5);
	let injectionInput = $state('127.0.0.1; id; cat /proc/self/uid_map');

	let lastUploadStatus = $state<{ status: 'idle' | 'running' | 'ok' | 'error'; text?: string }>({ status: 'idle' });
	let lastSuidStatus = $state<{ status: 'idle' | 'running' | 'ok' | 'error'; text?: string }>({ status: 'idle' });
	let lastSetcapStatus = $state<{ status: 'idle' | 'running' | 'ok' | 'error'; text?: string }>({ status: 'idle' });
	let lastPingStatus = $state<{ status: 'idle' | 'running' | 'ok' | 'error'; text?: string }>({ status: 'idle' });
	let lastDumpStatus = $state<{ status: 'idle' | 'running' | 'ok' | 'error'; text?: string }>({ status: 'idle' });
	let lastRansomStatus = $state<{ status: 'idle' | 'running' | 'ok' | 'error'; text?: string }>({ status: 'idle' });
	let lastCgroupStatus = $state<{ status: 'idle' | 'running' | 'ok' | 'error'; text?: string }>({ status: 'idle' });

	let terminalSocket: WebSocket | null = null;
	let monitorSocket: WebSocket | null = null;
	let customerSocket: WebSocket | null = null;
	let mounted = false;

	const TERMINAL_MIN_WIDTH = 360;
	const TERMINAL_MAX_RATIO = 0.7;
	const TERMINAL_WIDTH_KEY = 'dokuru-lab.terminal.width';
	const TERMINAL_OPEN_KEY = 'dokuru-lab.terminal.open';
	const THEME_KEY = 'dokuru-lab.theme';

	let hostname = $state('');

	onMount(() => {
		mounted = true;
		hostname = window.location.host;
		updateMaxWidth();
		restoreState();
		window.addEventListener('resize', updateMaxWidth);
		connectMonitor();
		connectTerminal();
		connectCustomer();
		void fetchHostInfo();
		const hostInterval = window.setInterval(fetchHostInfo, 3000);
		return () => {
			mounted = false;
			window.removeEventListener('resize', updateMaxWidth);
			window.clearInterval(hostInterval);
			terminalSocket?.close();
			monitorSocket?.close();
			customerSocket?.close();
		};
	});

	function updateMaxWidth() {
		terminalMaxWidth = Math.max(TERMINAL_MIN_WIDTH, Math.floor(window.innerWidth * TERMINAL_MAX_RATIO));
		terminalWidth = Math.max(TERMINAL_MIN_WIDTH, Math.min(terminalMaxWidth, terminalWidth));
	}

	function restoreState() {
		try {
			const storedWidth = window.localStorage.getItem(TERMINAL_WIDTH_KEY);
			if (storedWidth) {
				const parsed = Number(storedWidth);
				if (Number.isFinite(parsed)) {
					terminalWidth = Math.max(TERMINAL_MIN_WIDTH, Math.min(terminalMaxWidth, parsed));
				}
			}
			const storedOpen = window.localStorage.getItem(TERMINAL_OPEN_KEY);
			terminalOpen = storedOpen === 'true';
			lightMode = window.localStorage.getItem(THEME_KEY) === 'light';
		} catch {
			/* localStorage unavailable */
		}
	}

	function toggleTheme() {
		lightMode = !lightMode;
		try {
			window.localStorage.setItem(THEME_KEY, lightMode ? 'light' : 'dark');
		} catch {
			/* ignore */
		}
	}

	function setTerminalWidth(next: number) {
		terminalWidth = Math.max(TERMINAL_MIN_WIDTH, Math.min(terminalMaxWidth, next));
	}

	function persistTerminalWidth() {
		try {
			window.localStorage.setItem(TERMINAL_WIDTH_KEY, String(terminalWidth));
		} catch {
			/* ignore */
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
		terminalOpen = false;
		try {
			window.localStorage.setItem(TERMINAL_OPEN_KEY, 'false');
		} catch {
			/* ignore */
		}
	}

	function onResizePointerDown(event: PointerEvent) {
		terminalResizing = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		document.body.style.userSelect = 'none';
		document.body.style.cursor = 'col-resize';
	}

	function onResizePointerMove(event: PointerEvent) {
		if (!terminalResizing) return;
		const next = window.innerWidth - event.clientX;
		terminalWidth = Math.max(TERMINAL_MIN_WIDTH, Math.min(terminalMaxWidth, next));
	}

	function onResizePointerUp(event: PointerEvent) {
		terminalResizing = false;
		(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		try {
			window.localStorage.setItem(TERMINAL_WIDTH_KEY, String(terminalWidth));
		} catch {
			/* ignore */
		}
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

	function wsUrl(path: string): string {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${protocol}//${window.location.host}${path}`;
	}

	function parseSocket(value: unknown): Record<string, unknown> | null {
		try {
			return JSON.parse(String(value)) as Record<string, unknown>;
		} catch {
			return null;
		}
	}

	function connectMonitor() {
		monitorSocket = new WebSocket(wsUrl('/ws/monitor'));
		monitorSocket.onopen = () => (monitorConnected = true);
		monitorSocket.onmessage = (event) => {
			const msg = parseSocket(event.data);
			if (msg?.type !== 'monitor.evidence') return;
			evidence = msg.runtime as RuntimeEvidence;
			lastUpdated = timeLabel(msg.at);
		};
		monitorSocket.onclose = () => {
			monitorConnected = false;
			if (mounted) window.setTimeout(connectMonitor, 900);
		};
	}

	function connectCustomer() {
		customerSocket = new WebSocket(wsUrl('/ws/customer'));
		customerSocket.onopen = () => (customerConnected = true);
		customerSocket.onmessage = (event) => {
			const msg = parseSocket(event.data);
			if (msg?.type !== 'customer.sample') return;
			const sample = msg.sample as CustomerSample | undefined;
			if (!sample) return;
			customerSamples = [...customerSamples, sample].slice(-120);
		};
		customerSocket.onclose = () => {
			customerConnected = false;
			if (mounted) window.setTimeout(connectCustomer, 900);
		};
	}

	let activeShellEventId = $state<string | null>(null);
	let activeActionType = $state<string | null>(null);

	function connectTerminal() {
		terminalSocket = new WebSocket(wsUrl('/ws/terminal'));
		terminalSocket.onopen = () => (terminalConnected = true);
		terminalSocket.onmessage = (event) => {
			const msg = parseSocket(event.data);
			if (!msg) return;

			if (msg.type === 'terminal.payload') {
				activePayload = normalizePayload(msg.payload);
				return;
			}

			if (msg.type === 'terminal.line') {
				const stream = msg.stream as 'stdout' | 'stderr' | 'stdin' | 'system';
				const text = String(msg.text || '');
				appendShellLine(stream, text);
				return;
			}

			if (msg.type === 'terminal.start') {
				const action = String(msg.action || 'terminal');
				running = action;
				activeActionType = action;
				startShellEvent(action);
				return;
			}

			if (msg.type === 'terminal.exit') {
				const code = msg.code as number | undefined;
				const action = activeActionType;
				finishShellEvent(code ?? null);
				running = '';
				activeActionType = null;
				updateStatusByAction(action, code === 0 || code === undefined ? 'ok' : 'error');
				return;
			}
		};
		terminalSocket.onclose = () => {
			terminalConnected = false;
			running = '';
			if (mounted) window.setTimeout(connectTerminal, 900);
		};
	}

	function normalizePayload(value: unknown): ActivePayload | null {
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

	function updateStatusByAction(action: string | null, status: 'ok' | 'error') {
		if (!action) return;
		const text = `${action} · ${timeLabel()}`;
		if (action === 'pid-bomb' || action === 'memory-bomb' || action === 'cpu-burn' || action === 'cpu-blast' || action === 'cleanup' || action === 'stop-payloads') {
			lastCgroupStatus = { status, text };
		}
	}

	function startShellEvent(action: string) {
		const id = `sh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		activeShellEventId = id;
		events = [
			...events,
			{
				id,
				at: timeLabel(),
				kind: 'shell' as const,
				command: action === 'exec' ? undefined : `dokuru-lab ${action}`,
				lines: [],
				running: true
			}
		].slice(-200);
	}

	function appendShellLine(stream: 'stdout' | 'stderr' | 'stdin' | 'system', text: string) {
		if (!activeShellEventId) return;
		events = events.map((e) =>
			e.id === activeShellEventId && e.kind === 'shell'
				? { ...e, lines: [...e.lines.slice(-400), { stream, text }] }
				: e
		);
	}

	function finishShellEvent(exitCode: number | null) {
		if (!activeShellEventId) return;
		events = events.map((e) =>
			e.id === activeShellEventId && e.kind === 'shell'
				? { ...e, running: false, exitCode }
				: e
		);
		activeShellEventId = null;
	}

	function sendTerminal(payload: Record<string, unknown>) {
		if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) {
			appendSystemEvent('terminal websocket not connected', 'error');
			return;
		}
		terminalSocket.send(JSON.stringify(payload));
	}

	function appendSystemEvent(text: string, level: 'info' | 'warn' | 'error' = 'info') {
		const id = `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		events = [...events, { id, at: timeLabel(), kind: 'system' as const, text, level }].slice(-200);
	}

	async function requestJson(method: string, path: string, body?: unknown): Promise<LabResponse> {
		const id = `http-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const startedAt = performance.now();
		events = [
			...events,
			{
				id,
				at: timeLabel(),
				kind: 'http' as const,
				method,
				path,
				body,
				duration: undefined
			}
		].slice(-200);
		try {
			const init: RequestInit = {
				method,
				...(body !== undefined
					? {
							headers: { 'content-type': 'application/json' },
							body: JSON.stringify(body)
						}
					: {})
			};
			const response = await fetch(path, init);
			const text = await response.text();
			const duration = Math.round(performance.now() - startedAt);
			let parsed: LabResponse;
			try {
				parsed = JSON.parse(text) as LabResponse;
			} catch {
				parsed = { ok: response.ok, output: text };
			}
			events = events.map((e) =>
				e.id === id && e.kind === 'http'
					? { ...e, status: response.status, duration, response: parsed }
					: e
			);
			return { http_status: response.status, ...parsed };
		} catch (error) {
			const duration = Math.round(performance.now() - startedAt);
			const message = error instanceof Error ? error.message : String(error);
			events = events.map((e) =>
				e.id === id && e.kind === 'http' ? { ...e, duration, error: message } : e
			);
			return { ok: false, error: message };
		}
	}

	async function requestForm(path: string, form: FormData): Promise<LabResponse> {
		const id = `http-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const startedAt = performance.now();
		events = [
			...events,
			{ id, at: timeLabel(), kind: 'http' as const, method: 'POST', path, body: '[multipart/form-data]', duration: undefined }
		].slice(-200);
		try {
			const response = await fetch(path, { method: 'POST', body: form });
			const text = await response.text();
			const duration = Math.round(performance.now() - startedAt);
			const parsed = JSON.parse(text) as LabResponse;
			events = events.map((e) =>
				e.id === id && e.kind === 'http'
					? { ...e, status: response.status, duration, response: parsed }
					: e
			);
			return { http_status: response.status, ...parsed };
		} catch (error) {
			const duration = Math.round(performance.now() - startedAt);
			const message = error instanceof Error ? error.message : String(error);
			events = events.map((e) =>
				e.id === id && e.kind === 'http' ? { ...e, duration, error: message } : e
			);
			return { ok: false, error: message };
		}
	}

	function clearEvents() {
		events = [];
	}

	function sendShellInput(text: string) {
		if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) return;
		if (!activeShellEventId) {
			sendTerminal({ type: 'exec', command: text });
			return;
		}
		sendTerminal({ type: 'stdin', data: text + '\n' });
	}

	// ── Attack handlers ────────────────────────────────────────────────
	async function fetchHostInfo() {
		try {
			const response = await fetch('/api/monitor/host');
			if (response.ok) hostInfo = await response.json();
		} catch {
			/* keep last */
		}
	}

	async function planSuid() {
		lastSuidStatus = { status: 'running', text: 'planting…' };
		const result = await requestJson('POST', '/api/exploit/suid-trap');
		lastSuidStatus = {
			status: result.ok ? 'ok' : 'error',
			text: result.ok ? `planted · ${timeLabel()}` : 'failed'
		};
	}

	async function planSetcap() {
		lastSetcapStatus = { status: 'running', text: 'planting…' };
		const result = await requestJson('POST', '/api/exploit/setcap-trap');
		lastSetcapStatus = {
			status: result.ok ? 'ok' : 'error',
			text: result.ok ? `planted · ${timeLabel()}` : 'rejected'
		};
	}

	async function cleanupTraps() {
		const result = await requestJson('POST', '/api/exploit/cleanup-traps');
		lastSuidStatus = { status: result.ok ? 'idle' : 'error', text: result.ok ? undefined : 'cleanup failed' };
		lastSetcapStatus = { status: result.ok ? 'idle' : 'error', text: result.ok ? undefined : 'cleanup failed' };
	}

	async function writeMarker() {
		lastUploadStatus = { status: 'running', text: 'writing…' };
		const payload = [
			'Dokuru baseline ownership proof',
			`created_at=${new Date().toISOString()}`,
			'purpose=container-root-writes-bind-mount-as-host-root',
			''
		].join('\n');
		const form = new FormData();
		form.set('file', new File([payload], 'ownership-proof.txt', { type: 'text/plain' }));
		const result = await requestForm('/api/upload', form);
		lastUploadStatus = {
			status: result.ok ? 'ok' : 'error',
			text: result.ok ? `written · ${timeLabel()}` : 'failed'
		};
	}

	async function executeInjection() {
		lastPingStatus = { status: 'running', text: 'executing…' };
		const result = await requestJson('GET', `/api/ping?host=${encodeURIComponent(injectionInput)}`);
		lastPingStatus = {
			status: result.ok ? 'ok' : 'error',
			text: result.ok ? `shell · ${timeLabel()}` : 'failed'
		};
	}

	async function dumpAppData() {
		lastDumpStatus = { status: 'running', text: 'dumping…' };
		const result = await requestJson('POST', '/api/demo/dump');
		lastDumpStatus = {
			status: result.ok ? 'ok' : 'error',
			text: result.ok ? `dumped · ${timeLabel()}` : 'failed'
		};
	}

	async function runRansomware() {
		lastRansomStatus = { status: 'running', text: 'encrypting…' };
		const result = await requestJson('POST', '/api/exploit/ransomware');
		lastRansomStatus = {
			status: result.ok ? 'ok' : 'error',
			text: result.ok ? `encrypted · ${timeLabel()}` : 'failed'
		};
	}

	async function restoreData() {
		lastRansomStatus = { status: 'running', text: 'restoring…' };
		const result = await requestJson('POST', '/api/demo/reset');
		lastRansomStatus = {
			status: result.ok ? 'idle' : 'error',
			text: result.ok ? undefined : 'restore failed'
		};
	}

	function runPidBomb() {
		lastCgroupStatus = { status: 'running', text: `fork × ${pidCount}` };
		sendTerminal({ type: 'pid-bomb', count: pidCount });
	}

	function runMemoryBomb() {
		lastCgroupStatus = { status: 'running', text: `${memoryMb}MB held` };
		sendTerminal({ type: 'memory-bomb', mb: memoryMb });
	}

	function runCpuBurn() {
		lastCgroupStatus = { status: 'running', text: `${cpuSeconds}s burn` };
		sendTerminal({ type: 'cpu-burn', seconds: cpuSeconds });
	}

	function stopPayloads() {
		sendTerminal({ type: 'stop-payloads' });
	}

	function cleanupCgroup() {
		sendTerminal({ type: 'cleanup' });
	}

	function seedData() {
		void requestJson('POST', '/api/demo/seed');
	}

	// ── Derived metrics ─────────────────────────────────────────────────
	function asNumber(value?: string): number | null {
		if (!value || value === 'max' || value === 'unavailable') return null;
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : null;
	}

	function percentOf(current?: string, max?: string): number {
		const c = asNumber(current) ?? 0;
		const m = asNumber(max);
		if (!m || m > 1_000_000_000_000) return 0;
		return Math.min(100, Math.round((c / m) * 100));
	}

	function formatBytes(value?: string): string {
		if (!value || value === 'unavailable') return '—';
		if (value === 'max') return '∞';
		const bytes = asNumber(value);
		if (bytes === null) return value;
		const mib = bytes / 1024 / 1024;
		return mib >= 1024 ? `${(mib / 1024).toFixed(1)}G` : `${mib.toFixed(mib >= 100 ? 0 : 1)}M`;
	}

	function firstLine(value?: string): string {
		return value?.split('\n')[0]?.trim() || '—';
	}

	const pidPct = $derived(percentOf(evidence?.cgroup.pids_current, evidence?.cgroup.pids_max));
	const memPct = $derived(percentOf(evidence?.cgroup.memory_current, evidence?.cgroup.memory_max));
	const hostMemPct = $derived(
		hostInfo.memory_total_gb
			? Math.min(100, Math.round(((hostInfo.memory_total_gb - hostInfo.memory_available_gb) / hostInfo.memory_total_gb) * 100))
			: 0
	);

	const uidMapFirst = $derived(firstLine(evidence?.uid_map));
	const isBaseline = $derived(uidMapFirst.startsWith('0') && uidMapFirst.includes('4294967295'));
	const isHardened = $derived(uidMapFirst.startsWith('0') && /^\s*0\s+\d{4,}/.test(uidMapFirst) && !isBaseline);

	const stateBadge = $derived(
		isBaseline
			? { label: 'baseline · default docker', class: 'border-commerce/40 text-commerce bg-commerce/5' }
			: isHardened
				? { label: 'hardened · userns-remap', class: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' }
				: { label: 'unknown · loading', class: 'border-black/15 text-body-gray bg-black/5' }
	);

	const cgroupMemoryUnlimited = $derived(evidence?.cgroup.memory_max === 'max');
	const cgroupCpuUnlimited = $derived(
		!evidence?.cgroup.cpu_max ||
			evidence.cgroup.cpu_max === 'max 100000' ||
			evidence.cgroup.cpu_max.startsWith('max ')
	);
	const cgroupPidsUnlimited = $derived(
		!evidence?.cgroup.pids_max ||
			evidence.cgroup.pids_max === 'max' ||
			asNumber(evidence.cgroup.pids_max) === null ||
			(asNumber(evidence.cgroup.pids_max) ?? 0) > 10000
	);

	const latestCustomer = $derived(customerSamples.at(-1));
	const recentCustomer = $derived(customerSamples.slice(-28));
	const avgLatency = $derived(averageLatency(recentCustomer));
	const failCount = $derived(recentCustomer.filter((s) => !s.ok).length);

	function averageLatency(values: CustomerSample[]): string {
		const ok = values.filter((v) => v.ok && Number.isFinite(v.latency_ms));
		if (ok.length === 0) return '—';
		const avg = ok.reduce((sum, s) => sum + s.latency_ms, 0) / ok.length;
		return `${Math.round(avg)}ms`;
	}

	function barHeight(sample: CustomerSample): number {
		if (!sample.ok) return 100;
		return Math.max(6, Math.min(100, Math.round((sample.latency_ms / 1000) * 100)));
	}

	function barClass(sample: CustomerSample): string {
		if (!sample.ok) return 'bg-commerce';
		if (sample.latency_ms >= 750) return 'bg-commerce';
		if (sample.latency_ms >= 250) return 'bg-amber-400';
		return 'bg-playstation-cyan';
	}
</script>

<div class={`flex min-h-screen ${lightMode ? 'bg-[#f5f7fa] text-ink' : 'bg-[#050608] text-white'}`}>
	<!-- ═══════════════════════════════════════════════════════════════ -->
	<!-- Main dashboard                                                   -->
	<!-- ═══════════════════════════════════════════════════════════════ -->
	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Header (slim, sticky, auto-detect state) -->
		<header class={`sticky top-0 z-20 flex h-[52px] shrink-0 items-center gap-4 border-b px-4 backdrop-blur sm:px-6 ${lightMode ? 'border-black/5 bg-white/95' : 'border-white/5 bg-black/95'}`}>
			<a href="/" class={`inline-flex items-center gap-2.5 no-underline ${lightMode ? 'text-ink' : 'text-white'}`}>
				<span class={`grid h-7 w-7 place-items-center rounded-full ${lightMode ? 'bg-playstation-blue text-white' : 'bg-white text-playstation-blue'}`}>
					<FlaskConical size={14} strokeWidth={2.2} />
				</span>
				<span class="text-[14.5px] font-semibold tracking-tight">Dokuru Lab</span>
			</a>

			<span class={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${stateBadge.class}`}>
				<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
				{stateBadge.label}
			</span>

			<nav class={`ml-auto hidden items-center gap-4 font-mono text-[10.5px] uppercase tracking-[0.08em] lg:flex ${lightMode ? 'text-body-gray' : 'text-white/45'}`}>
				<a href="#attacks" class={`inline-flex items-center gap-1.5 transition ${lightMode ? 'hover:text-ink' : 'hover:text-white'}`}>
					<Bomb size={11} strokeWidth={2.2} />
					Attacks
				</a>
				<a href="#signals" class={`inline-flex items-center gap-1.5 transition ${lightMode ? 'hover:text-ink' : 'hover:text-white'}`}>
					<Gauge size={11} strokeWidth={2.2} />
					Signals
				</a>
				<span class="inline-flex items-center gap-1.5">
					<Waves size={11} strokeWidth={2.2} class={monitorConnected ? 'text-emerald-400' : 'text-commerce'} />
					<span>monitor</span>
				</span>
				<span class="inline-flex items-center gap-1.5">
					<Radio size={11} strokeWidth={2.2} class={customerConnected ? 'text-emerald-400' : 'text-commerce'} />
					<span>customer</span>
				</span>
			</nav>

			<button
				type="button"
				onclick={toggleTheme}
				aria-label={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
				class={`ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-mono text-[10px] uppercase tracking-[0.08em] transition lg:ml-0 ${lightMode ? 'border-black/10 bg-black/[0.03] text-body-gray hover:border-black/20 hover:text-ink' : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'}`}
			>
				{#if lightMode}<Moon size={11} strokeWidth={2.2} />{:else}<Sun size={11} strokeWidth={2.2} />{/if}
				<span>{lightMode ? 'dark' : 'light'}</span>
			</button>
		</header>

		<!-- Active payload banner -->
		{#if activePayload}
			<div class="border-b border-commerce/30 bg-commerce/10 px-4 py-2 sm:px-6">
				<div class="mx-auto flex max-w-[1640px] items-center justify-between gap-4">
					<div class="flex items-center gap-3 font-mono text-[11.5px] text-commerce">
						<span class="inline-flex h-2 w-2 animate-pulse rounded-full bg-commerce" aria-hidden="true"></span>
						<span class="uppercase tracking-[0.1em]">Active payload</span>
						<span class={lightMode ? 'text-ink' : 'text-white'}>{activePayload.label}</span>
					</div>
					<Button size="sm" variant="commerce" onclick={stopPayloads} disabled={running === 'stop-payloads'}>
						Stop payload
					</Button>
				</div>
			</div>
		{/if}

		<!-- Main grid: attacks (left) + signals (right) -->
		<main class="mx-auto flex w-full max-w-[1640px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5 lg:px-6 xl:grid-cols-[minmax(0,1fr)_420px]">
			<!-- ════ ATTACK PAD (left) ════════════════════════════════════ -->
			<section id="attacks" class="min-w-0 space-y-5">
				<div class="mb-2 flex items-center gap-3">
					<Bomb size={15} strokeWidth={2.2} class="text-commerce" />
					<h2 class={`m-0 font-mono text-[13px] uppercase tracking-[0.14em] ${lightMode ? 'text-ink' : 'text-white'}`}>Attack pad</h2>
					<span class={`font-mono text-[10.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>from compromised container</span>
				</div>

				<!-- Section B: Docker misconfig (KEY demos) -->
				<div id="docker-misconfig" class={`space-y-3 rounded-lg border p-4 ${lightMode ? 'border-black/5 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'border-white/5 bg-white/[0.015]'}`}>
					<div class="flex items-center gap-2">
						<ShieldAlert size={13} strokeWidth={2.2} class="text-commerce" />
						<h3 class={`m-0 text-[12px] font-semibold uppercase tracking-[0.1em] ${lightMode ? 'text-ink' : 'text-white/85'}`}>Docker misconfig exploits</h3>
						<span class="rounded-full bg-commerce/15 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-commerce">Dokuru fixes these</span>
					</div>

					<div class="grid gap-3 xl:grid-cols-2">
						<AttackCard
							icon={ShieldAlert}
							index="B2"
							title="SUID LPE Honeypot"
							description="Drop a SUID artifact into uploads. Baseline: container root can create host-root-owned files on the bind mount. Hardened: userns maps it to UID 100000."
							rule="rule 2.10"
							tag="key"
							accent="commerce"
							status={lastSuidStatus.status}
							statusText={lastSuidStatus.text}
						>
							<Button size="sm" variant="commerce" onclick={planSuid} disabled={lastSuidStatus.status === 'running'}>Plant SUID trap</Button>
							<Button size="sm" variant="ghost" onclick={cleanupTraps} disabled={lastSuidStatus.status === 'running' || lastSetcapStatus.status === 'running'}>Cleanup</Button>
						</AttackCard>

						<AttackCard
							icon={KeySquare}
							index="B3"
							title="Capability trap (setcap)"
							description="Grant binary network admin + raw socket capabilities. Baseline: setcap succeeds. Hardened: kernel rejects (no CAP_SETFCAP in init user ns)."
							rule="rule 2.10"
							tag="advanced"
							status={lastSetcapStatus.status}
							statusText={lastSetcapStatus.text}
						>
							<Button size="sm" onclick={planSetcap} disabled={lastSetcapStatus.status === 'running'}>Plant setcap trap</Button>
						</AttackCard>

						<AttackCard
							icon={Upload}
							index="B1"
							title="Bind mount ownership"
							description="Write a harmless marker into /app/uploads. Baseline: file on host as root:root. Hardened: owned by remapped UID — no host privilege."
							rule="rule 2.10"
							tag="proof"
							status={lastUploadStatus.status}
							statusText={lastUploadStatus.text}
						>
							<Button size="sm" onclick={writeMarker} disabled={lastUploadStatus.status === 'running'}>Write ownership marker</Button>
						</AttackCard>

						<AttackCard
							icon={Zap}
							index="B4"
							title="Cgroup pressure"
							description="Fork / memory / CPU bombs. Baseline: host-level damage. Hardened: cgroup limits cap the blast at container scope."
							rule="rule 5.11/5.12/5.29"
							status={lastCgroupStatus.status}
							statusText={lastCgroupStatus.text || activePayload?.label}
						>
							<div class="w-full space-y-2">
								<div class="grid grid-cols-3 gap-2">
									<label class="flex flex-col gap-1">
										<span class="font-mono text-[9.5px] uppercase tracking-[0.08em] text-body-gray">PIDs</span>
										<input
											type="number"
											min="1"
											max="500"
											value={pidCount}
											oninput={(e) => (pidCount = Number(e.currentTarget.value) || 0)}
											class="w-full rounded-md border border-black/10 bg-white px-2 py-1 font-mono text-[12px] text-ink focus:ring-1 focus:ring-playstation-blue focus:outline-none"
										/>
									</label>
									<label class="flex flex-col gap-1">
										<span class="font-mono text-[9.5px] uppercase tracking-[0.08em] text-body-gray">Memory MB</span>
										<input
											type="number"
											min="1"
											max="3500"
											value={memoryMb}
											oninput={(e) => (memoryMb = Number(e.currentTarget.value) || 0)}
											class="w-full rounded-md border border-black/10 bg-white px-2 py-1 font-mono text-[12px] text-ink focus:ring-1 focus:ring-playstation-blue focus:outline-none"
										/>
									</label>
									<label class="flex flex-col gap-1">
										<span class="font-mono text-[9.5px] uppercase tracking-[0.08em] text-body-gray">CPU s</span>
										<input
											type="number"
											min="1"
											max="30"
											value={cpuSeconds}
											oninput={(e) => (cpuSeconds = Number(e.currentTarget.value) || 0)}
											class="w-full rounded-md border border-black/10 bg-white px-2 py-1 font-mono text-[12px] text-ink focus:ring-1 focus:ring-playstation-blue focus:outline-none"
										/>
									</label>
								</div>
								<div class="flex flex-wrap gap-2">
									<Button size="sm" onclick={runPidBomb} disabled={Boolean(running)}>Fork bomb</Button>
									<Button size="sm" onclick={runMemoryBomb} disabled={Boolean(running)}>Memory bomb</Button>
									<Button size="sm" onclick={runCpuBurn} disabled={Boolean(running)}>CPU burn</Button>
									<Button size="sm" variant="ghost" onclick={cleanupCgroup}>Cleanup</Button>
								</div>
							</div>
						</AttackCard>
					</div>
				</div>

				<!-- Section A: Entry point -->
				<div id="entry" class={`space-y-3 rounded-lg border p-4 ${lightMode ? 'border-black/5 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'border-white/5 bg-white/[0.015]'}`}>
					<div class="flex items-center gap-2">
						<Bomb size={13} strokeWidth={2.2} class="text-amber-400" />
						<h3 class={`m-0 text-[12px] font-semibold uppercase tracking-[0.1em] ${lightMode ? 'text-ink' : 'text-white/85'}`}>Entry point</h3>
						<span class="rounded-full bg-amber-400/15 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-amber-300">app bug · not Dokuru scope</span>
					</div>

					<AttackCard
						icon={TerminalIcon}
						index="A0"
						title="Command injection RCE"
						description="Diagnostic endpoint passes input to ping through the shell. CVE pattern: CVE-2023-1389, CVE-2024-3400, CVE-2024-21887. Works before AND after Dokuru — it is the entry point for all other primitives."
						tag="star"
						accent="commerce"
						status={lastPingStatus.status}
						statusText={lastPingStatus.text}
					>
						<div class="flex w-full flex-col gap-2">
							<input
								type="text"
								value={injectionInput}
								oninput={(e) => (injectionInput = e.currentTarget.value)}
								placeholder="127.0.0.1; id; cat /proc/self/uid_map"
								class="w-full rounded-md border border-black/10 bg-white px-2.5 py-1.5 font-mono text-[12px] text-ink focus:ring-1 focus:ring-playstation-blue focus:outline-none"
							/>
							<div class="flex gap-2">
									<Button size="sm" variant="commerce" onclick={executeInjection} disabled={lastPingStatus.status === 'running'}>Execute injection</Button>
							</div>
						</div>
					</AttackCard>
				</div>

				<!-- Section C: App-level (scope boundary) -->
				<div id="app-level" class={`space-y-3 rounded-lg border p-4 ${lightMode ? 'border-black/5 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'border-white/5 bg-white/[0.015]'}`}>
					<div class="flex items-center gap-2">
						<Lock size={13} strokeWidth={2.2} class={lightMode ? 'text-body-gray' : 'text-white/50'} />
						<h3 class={`m-0 text-[12px] font-semibold uppercase tracking-[0.1em] ${lightMode ? 'text-ink' : 'text-white/85'}`}>App-level consequences</h3>
						<span class={`rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${lightMode ? 'bg-black/5 text-body-gray' : 'bg-white/10 text-white/50'}`}>scope boundary</span>
					</div>
					<p class={`m-0 text-[11.5px] leading-snug ${lightMode ? 'text-body-gray' : 'text-white/50'}`}>
						These succeed regardless of Dokuru. Fix belongs at the application layer (input validation, secrets management). Dokuru limits blast radius to app data — not host.
					</p>

					<div class="grid gap-3 xl:grid-cols-2">
						<AttackCard
							icon={Radio}
							index="C1"
							title="Dump app data"
							description="Collect customer files, invoices, and reachable Postgres rows. Attacker has legitimate app reach."
							accent="muted"
							status={lastDumpStatus.status}
							statusText={lastDumpStatus.text}
						>
							<Button size="sm" variant="ghost" onclick={seedData}>Seed data</Button>
							<Button size="sm" onclick={dumpAppData} disabled={lastDumpStatus.status === 'running'}>Dump</Button>
						</AttackCard>

						<AttackCard
							icon={Lock}
							index="C2"
							title="App data ransomware"
							description="Encrypt 200 mock customer files (reversible). Dokuru does not block — same scope before & after."
							accent="muted"
							status={lastRansomStatus.status}
							statusText={lastRansomStatus.text}
						>
							<Button size="sm" variant="commerce" onclick={runRansomware} disabled={lastRansomStatus.status === 'running'}>Encrypt files</Button>
							<Button size="sm" variant="ghost" onclick={restoreData} disabled={lastRansomStatus.status === 'running'}>Restore</Button>
						</AttackCard>
					</div>
				</div>
			</section>

			<!-- ════ SIGNAL PANEL (right) ════════════════════════════════ -->
			<aside id="signals" class="space-y-3 lg:sticky lg:top-[68px] lg:self-start">
				<div class="mb-2 flex items-center gap-3">
					<Gauge size={15} strokeWidth={2.2} class="text-playstation-cyan" />
				<h2 class={`m-0 font-mono text-[13px] uppercase tracking-[0.14em] ${lightMode ? 'text-ink' : 'text-white'}`}>Live signal</h2>
					{#if lastUpdated}
						<span class={`ml-auto font-mono text-[10.5px] tabular-nums ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>{lastUpdated}</span>
					{/if}
				</div>

				<!-- Customer latency card -->
				<article class={`rounded-lg border p-3.5 ${lightMode ? 'border-black/5 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'border-white/8 bg-gradient-to-br from-[#08202e] to-[#050608]'}`}>
					<header class="mb-2 flex items-center justify-between gap-2">
						<div class="flex items-center gap-2">
							<span class="grid h-6 w-6 place-items-center rounded-md bg-playstation-cyan/15 text-playstation-cyan">
								<ShoppingCart size={12} strokeWidth={2} />
							</span>
							<span class={`font-mono text-[10px] uppercase tracking-[0.1em] ${lightMode ? 'text-body-gray' : 'text-white/60'}`}>Customer latency</span>
						</div>
						<span class={`font-mono text-[10px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>
							{latestCustomer?.ok ? `http ${latestCustomer.status}` : latestCustomer?.ok === false ? 'down' : '—'}
						</span>
					</header>

					<div class="mb-3 flex items-baseline justify-between gap-2">
						<strong class={`font-mono text-[28px] font-light tabular-nums ${lightMode ? 'text-ink' : 'text-white'}`}>
							{latestCustomer?.ok ? `${latestCustomer.latency_ms}` : latestCustomer ? '—' : '—'}
							<span class={`text-[14px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>ms</span>
						</strong>
						<div class="flex flex-col items-end gap-0.5 text-right">
							<span class={`font-mono text-[10.5px] ${lightMode ? 'text-body-gray' : 'text-white/50'}`}>avg {avgLatency}</span>
							<span class={`font-mono text-[10.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>{recentCustomer.length} · {failCount} fail</span>
						</div>
					</div>

					<div class={`flex h-14 items-end gap-[2px] rounded-md p-1.5 ${lightMode ? 'bg-black/[0.03]' : 'bg-black/40'}`}>
						{#if recentCustomer.length === 0}
							<span class={`w-full text-center font-mono text-[10px] ${lightMode ? 'text-body-gray' : 'text-white/30'}`}>waiting /ws/customer…</span>
						{/if}
						{#each recentCustomer as sample}
							<div
								class={`min-w-[2px] flex-1 rounded-t ${barClass(sample)}`}
								style={`height: ${barHeight(sample)}%`}
								title={sample.ok ? `${sample.latency_ms}ms` : sample.error || 'failed'}
							></div>
						{/each}
					</div>
				</article>

				<SignalCard
					icon={Hash}
					label="PIDs"
					rule="5.29"
					value={evidence?.cgroup.pids_current || '—'}
					valueSuffix={`/ ${evidence?.cgroup.pids_max || '—'}`}
					progress={pidPct}
					progressColor="blue"
					alert={cgroupPidsUnlimited ? 'warn' : null}
				>
					{#snippet children()}
						<div class="flex items-center justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>sleepers</span>
							<span class={`font-mono text-[10.5px] tabular-nums ${lightMode ? 'text-ink' : 'text-white/70'}`}>{evidence?.processes.pid_bomb_sleepers || '0'}</span>
						</div>
						{#if cgroupPidsUnlimited}
							<div class="rounded bg-amber-400/10 px-1.5 py-1 font-mono text-[9.5px] text-amber-300">pid limit not configured</div>
						{/if}
					{/snippet}
				</SignalCard>

				<SignalCard
					icon={MemoryStick}
					label="Memory"
					rule="5.11"
					value={formatBytes(evidence?.cgroup.memory_current)}
					valueSuffix={`/ ${formatBytes(evidence?.cgroup.memory_max)}`}
					progress={memPct}
					progressColor="cyan"
					alert={cgroupMemoryUnlimited ? 'danger' : null}
				>
					{#snippet children()}
						<div class="flex items-center justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>host total</span>
							<span class={`font-mono text-[10.5px] tabular-nums ${lightMode ? 'text-ink' : 'text-white/70'}`}>{hostInfo.memory_total_gb} GB</span>
						</div>
						<div class="flex items-center justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>host available</span>
							<span class={`font-mono text-[10.5px] tabular-nums ${lightMode ? 'text-ink' : 'text-white/70'}`}>{hostInfo.memory_available_gb} GB · {hostMemPct}%</span>
						</div>
						{#if cgroupMemoryUnlimited}
							<div class="rounded bg-commerce/10 px-1.5 py-1 font-mono text-[9.5px] text-commerce">unlimited — host-wide blast risk</div>
						{/if}
					{/snippet}
				</SignalCard>

				<SignalCard
					icon={Cpu}
					label="CPU"
					rule="5.12"
					value={`${hostInfo.cpu_usage_percent}%`}
					valueSuffix="host"
					alert={cgroupCpuUnlimited ? 'warn' : null}
				>
					{#snippet children()}
						<div class="flex items-center justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>cores</span>
							<span class={`font-mono text-[10.5px] tabular-nums ${lightMode ? 'text-ink' : 'text-white/70'}`}>{hostInfo.cpu_cores}</span>
						</div>
						<div class="flex items-center justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>cpu.max</span>
							<span class={`font-mono text-[10.5px] tabular-nums ${lightMode ? 'text-ink' : 'text-white/70'}`}>{evidence?.cgroup.cpu_max || '—'}</span>
						</div>
						<div class="flex items-center justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>cpu.weight</span>
							<span class={`font-mono text-[10.5px] tabular-nums ${lightMode ? 'text-ink' : 'text-white/70'}`}>{evidence?.cgroup.cpu_weight || '—'}</span>
						</div>
						<div class="flex items-center justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>burners</span>
							<span class={`font-mono text-[10.5px] tabular-nums ${(evidence?.cgroup.active_cpu_burners ?? 0) > 0 ? 'text-commerce' : lightMode ? 'text-ink' : 'text-white/70'}`}>
								{evidence?.cgroup.active_cpu_burners ?? 0}
							</span>
						</div>
					{/snippet}
				</SignalCard>

				<SignalCard icon={UserCog} label="Namespace" rule="2.10">
					{#snippet children()}
						<div class="flex items-start justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>uid_map</span>
							<span class={`max-w-[60%] truncate font-mono text-[10.5px] tabular-nums ${lightMode ? 'text-ink' : 'text-white/80'}`}>{uidMapFirst}</span>
						</div>
						<div class="flex items-center justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>pid ns</span>
							<span class={`max-w-[60%] truncate font-mono text-[10.5px] ${lightMode ? 'text-ink' : 'text-white/70'}`}>{evidence?.pid_namespace || '—'}</span>
						</div>
						<div class="flex items-center justify-between gap-2">
							<span class={`font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>visible procs</span>
							<span class={`font-mono text-[10.5px] tabular-nums ${lightMode ? 'text-ink' : 'text-white/70'}`}>{evidence?.processes.process_count || '—'}</span>
						</div>
					{/snippet}
				</SignalCard>

				<SignalCard icon={Activity} label="Recent activity">
					{#snippet children()}
						<div class="space-y-1.5">
							{#if events.length === 0}
								<p class={`m-0 font-mono text-[10px] ${lightMode ? 'text-body-gray' : 'text-white/35'}`}>no actions yet</p>
							{/if}
							{#each events.slice(-5).reverse() as event (event.id)}
								<div class="flex items-start gap-2">
									<span class={`shrink-0 font-mono text-[9.5px] tabular-nums ${lightMode ? 'text-body-gray' : 'text-white/30'}`}>{event.at}</span>
									{#if event.kind === 'http'}
										<span class={`truncate font-mono text-[10px] ${lightMode ? 'text-ink' : 'text-white/70'}`}>
											{event.method} {event.path.replace(/^\/api\//, '')}
										</span>
										<span class={`ml-auto shrink-0 font-mono text-[9.5px] tabular-nums ${event.error ? 'text-commerce' : event.status && event.status < 400 ? 'text-emerald-400' : 'text-amber-300'}`}>
											{event.error ? 'ERR' : event.status || '…'}
										</span>
									{:else if event.kind === 'shell'}
										<span class="truncate font-mono text-[10px] text-emerald-400/80">$ {event.command || 'shell'}</span>
										<span class={`ml-auto shrink-0 font-mono text-[9.5px] ${lightMode ? 'text-body-gray' : 'text-white/40'}`}>{event.running ? '…' : 'done'}</span>
									{:else}
										<span class={`truncate font-mono text-[10px] ${lightMode ? 'text-body-gray' : 'text-white/55'}`}>{event.text}</span>
									{/if}
								</div>
							{/each}
						</div>
					{/snippet}
				</SignalCard>
			</aside>
		</main>

		<!-- Footer -->
		<footer class={`mt-auto border-t px-4 py-3 sm:px-6 ${lightMode ? 'border-black/5 bg-white/70' : 'border-white/5 bg-black/60'}`}>
			<div class={`mx-auto flex max-w-[1640px] items-center gap-3 font-mono text-[10.5px] tracking-[0.04em] ${lightMode ? 'text-body-gray' : 'text-white/35'}`}>
				<AlertOctagon size={12} strokeWidth={2} />
				<span>disposable lab host · endpoints intentionally expose shell execution and resource pressure</span>
				<span class="ml-auto">{hostname}</span>
			</div>
		</footer>
	</div>

	<!-- ═══════════════════════════════════════════════════════════════ -->
	<!-- Terminal sidebar (desktop right-docked, resizable)               -->
	<!-- ═══════════════════════════════════════════════════════════════ -->
	<TerminalHandle
		open={terminalOpen}
		width={terminalWidth}
		minWidth={TERMINAL_MIN_WIDTH}
		maxWidth={terminalMaxWidth}
		connected={terminalConnected}
		busy={Boolean(running)}
		eventCount={events.length}
		onToggle={toggleTerminal}
		onResize={setTerminalWidth}
		onResizeEnd={persistTerminalWidth}
	/>

	<aside
		class="sticky top-0 hidden h-screen shrink-0 self-start overflow-hidden border-l border-white/5 bg-[#0a0a0a] lg:block"
		style="width: {terminalOpen ? terminalWidth : 0}px; transition: {terminalResizing ? 'none' : 'width 220ms cubic-bezier(0.22,1,0.36,1)'};"
		aria-hidden={!terminalOpen}
	>
		<div class="relative flex h-full flex-col" style="width: {terminalWidth}px;">
			{#if terminalOpen}
				<!-- Resize handle on the left edge -->
				<button
					type="button"
					onpointerdown={onResizePointerDown}
					onpointermove={onResizePointerMove}
					onpointerup={onResizePointerUp}
					aria-label="Resize terminal"
					class="absolute top-0 left-0 z-10 h-full w-[3px] cursor-col-resize bg-transparent outline-none transition-colors hover:bg-playstation-cyan/40"
				></button>
			{/if}
			<TerminalEventLog
				{events}
				connected={terminalConnected}
				running={Boolean(running)}
				{hostname}
				onClear={clearEvents}
				onClose={closeTerminal}
				onSend={sendShellInput}
			/>
		</div>
	</aside>

	<!-- Mobile overlay drawer -->
	{#if terminalOpen}
		<div class="fixed inset-0 z-40 flex lg:hidden">
			<button type="button" onclick={closeTerminal} class="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-label="Close"></button>
			<div class="relative ml-auto flex h-full w-full max-w-md flex-col bg-[#0a0a0a]">
				<TerminalEventLog
					{events}
					connected={terminalConnected}
					running={Boolean(running)}
					{hostname}
					onClear={clearEvents}
					onClose={closeTerminal}
					onSend={sendShellInput}
				/>
			</div>
		</div>
	{/if}

	<!-- Mobile floating button -->
	{#if !terminalOpen}
		<button
			type="button"
			onclick={toggleTerminal}
			class="fixed right-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full bg-playstation-blue px-4 py-3 text-[13px] font-medium text-white shadow-[0_8px_20px_rgba(0,112,204,0.35)] lg:hidden"
			aria-label="Open terminal"
		>
			<TerminalIcon size={14} strokeWidth={2} />
			<span>Terminal</span>
			{#if events.length > 0}
				<span class="rounded-full bg-white/20 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
					{events.length > 99 ? '99+' : events.length}
				</span>
			{/if}
		</button>
	{/if}
</div>
