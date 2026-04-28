// @ts-nocheck
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { handler } from './build/handler.js';

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8080);
const dataDir = process.env.LAB_DATA_DIR || '/app/data';
const monitorSockets = new Set();
let memoryHold = [];

const server = createServer((request, response) => {
	handler(request, response);
});

const terminalServer = new WebSocketServer({ noServer: true });
const monitorServer = new WebSocketServer({ noServer: true });

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

	socket.destroy();
});

terminalServer.on('connection', (socket) => {
	line(socket, 'system', 'connected to dokuru-lab terminal websocket\n');
	line(socket, 'system', 'commands run inside the vulnerable container runtime\n');

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

setInterval(() => {
	const payload = { runtime: runtimeEvidence() };
	for (const socket of monitorSockets) {
		send(socket, 'monitor.evidence', payload);
	}
}, 500);

server.listen(port, host, () => {
	console.log(`Listening on http://${host}:${port}`);
});

async function handleTerminalMessage(socket, raw) {
	let message;
	try {
		message = JSON.parse(String(raw));
	} catch {
		line(socket, 'stderr', 'invalid terminal message: expected JSON\n');
		return;
	}

	const type = String(message.type || '');
	send(socket, 'terminal.start', { action: type });

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
	}
}

function runShell(socket, command, timeoutMs = 15_000) {
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

		child.stdout.on('data', (chunk) => line(socket, 'stdout', chunk.toString()));
		child.stderr.on('data', (chunk) => line(socket, 'stderr', chunk.toString()));
		child.on('error', (error) => line(socket, 'stderr', `${error.message}\n`));
		child.on('close', (code, signal) => {
			clearTimeout(timeout);
			line(socket, 'system', `process exited code=${code ?? 'null'} signal=${signal ?? 'none'}\n`);
			resolve();
		});
	});
}

async function runProbe(socket) {
	ensureDataDir();
	const path = join(dataDir, 'recovery-probe.txt');
	const payload = `probe=${new Date().toISOString()}\n`;
	line(socket, 'system', `$ printf %q ${JSON.stringify(payload.trim())} > ${path}\n`);
	writeFileSync(path, payload);
	line(socket, 'stdout', `wrote ${path}\n`);
	line(socket, 'stdout', payload);
	line(socket, 'stdout', `uid_map=${readFirst(['/proc/self/uid_map']).replaceAll('\n', ' | ')}\n`);
}

async function runPidBomb(socket, rawCount) {
	const count = clamp(Number(rawCount || 120), 1, 500);
	line(socket, 'system', `$ dokuru-lab pid-bomb --count ${count}\n`);
	let spawned = 0;

	for (let index = 0; index < count; index += 1) {
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

async function runMemoryBomb(socket, rawMb) {
	const mb = clamp(Number(rawMb || 128), 1, 1024);
	line(socket, 'system', `$ dokuru-lab memory-bomb --mb ${mb}\n`);

	for (let index = 0; index < mb; index += 1) {
		memoryHold.push(Buffer.alloc(1024 * 1024, 'a'));
		if ((index + 1) % 16 === 0 || index + 1 === mb) {
			line(socket, 'stdout', `allocated ${index + 1} MiB; held=${memoryHold.length} MiB; ${memorySummary()}\n`);
			await delay(20);
		}
	}
}

async function runCpuBurn(socket, rawSeconds) {
	const seconds = clamp(Number(rawSeconds || 5), 1, 30);
	line(socket, 'system', `$ dokuru-lab cpu-burn --seconds ${seconds}\n`);
	const script = `process.title='dokuru_cpu_burn'; const crypto = require('node:crypto'); const end = Date.now() + ${seconds} * 1000; let ops = 0; let last = Date.now(); console.log('cpu burn started for ${seconds}s'); while (Date.now() < end) { for (let i = 0; i < 5000; i++) crypto.createHash('sha256').update(String(ops++)).digest('hex'); if (Date.now() - last >= 500) { console.log('ops=' + ops); last = Date.now(); } } console.log('cpu burn done ops=' + ops);`;
	await new Promise((resolve) => {
		const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
		child.stdout.on('data', (chunk) => line(socket, 'stdout', chunk.toString()));
		child.stderr.on('data', (chunk) => line(socket, 'stderr', chunk.toString()));
		child.on('close', (code, signal) => {
			line(socket, 'system', `cpu burner exited code=${code ?? 'null'} signal=${signal ?? 'none'}\n`);
			resolve();
		});
	});
}

async function runCleanup(socket) {
	line(socket, 'system', 'dropping held memory buffers in the server process\n');
	memoryHold = [];
	await runShell(
		socket,
		"pkill -f '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep|[d]okuru_cpu_burn' 2>&1 || true",
		5_000
	);
	line(socket, 'stdout', `held memory cleared; ${cgroupSummary()}`);
}

function runtimeEvidence() {
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

function cgroupEvidence() {
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

function processEvidence() {
	return {
		process_count: commandSync("ps -eo pid= | wc -l | tr -d ' '"),
		pid_bomb_sleepers: commandSync("pgrep -fc '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep' 2>/dev/null || true"),
		cpu_burners: commandSync("pgrep -fc '[d]okuru_cpu_burn' 2>/dev/null || true"),
		top_processes: commandSync('ps -eo pid,ppid,user,comm | head -12')
	};
}

function cgroupSummary() {
	const cgroup = cgroupEvidence();
	return `pids.current=${cgroup.pids_current} pids.max=${cgroup.pids_max} memory.current=${cgroup.memory_current} memory.max=${cgroup.memory_max} cpu.weight=${cgroup.cpu_weight}\n`;
}

function memorySummary() {
	const cgroup = cgroupEvidence();
	return `memory.current=${cgroup.memory_current} memory.max=${cgroup.memory_max}`;
}

function readFirst(paths) {
	for (const path of paths) {
		try {
			return readFileSync(path, 'utf8').trim();
		} catch {}
	}
	return 'unavailable';
}

function commandSync(command) {
	return spawnSyncText('/bin/sh', ['-lc', command]);
}

function spawnSyncText(command, args) {
	try {
		return execFileSync(command, args, { encoding: 'utf8', timeout: 3000 }).trim();
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

function namespaceLink(path) {
	try {
		return readlinkSync(path);
	} catch {
		return 'unavailable';
	}
}

function ensureDataDir() {
	mkdirSync(dataDir, { recursive: true });
}

function send(socket, type, payload = {}) {
	if (socket.readyState !== 1) return;
	socket.send(JSON.stringify({ type, ...payload, at: new Date().toISOString() }));
}

function line(socket, stream, text) {
	send(socket, 'terminal.line', { stream, text });
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
	if (!Number.isFinite(value)) return min;
	return Math.min(Math.max(Math.trunc(value), min), max);
}
