import { exec as execCallback, execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { CgroupEvidence, LabResponse, ProcessEvidence, RuntimeEvidence } from '$lib/types/lab';

const exec = promisify(execCallback);
const dataDir = process.env.LAB_DATA_DIR || '/app/data';
let memoryHold: Buffer[] = [];

type ExecError = Error & {
	stdout?: string;
	stderr?: string;
};

export function readFirst(paths: string[]): string {
	for (const path of paths) {
		try {
			return readFileSync(path, 'utf8').trim();
		} catch {
			// Docker may expose cgroup v1 or v2 paths depending on the host.
		}
	}

	return 'unavailable';
}

export function cgroupEvidence(): CgroupEvidence {
	return {
		pids_current: readFirst(['/sys/fs/cgroup/pids.current', '/sys/fs/cgroup/pids/pids.current']),
		pids_max: readFirst(['/sys/fs/cgroup/pids.max', '/sys/fs/cgroup/pids/pids.max']),
		memory_current: readFirst([
			'/sys/fs/cgroup/memory.current',
			'/sys/fs/cgroup/memory/memory.usage_in_bytes'
		]),
		memory_max: readFirst([
			'/sys/fs/cgroup/memory.max',
			'/sys/fs/cgroup/memory/memory.limit_in_bytes'
		]),
		cpu_weight: readFirst(['/sys/fs/cgroup/cpu.weight']),
		cpu_max: readFirst(['/sys/fs/cgroup/cpu.max']),
		cpu_shares_v1: readFirst(['/sys/fs/cgroup/cpu/cpu.shares'])
	};
}

export function processEvidence(): ProcessEvidence {
	return {
		process_count: commandSync("ps -eo pid= | wc -l | tr -d ' '"),
		pid_bomb_sleepers: commandSync("pgrep -fc '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep' 2>/dev/null || true"),
		cpu_burners: commandSync("pgrep -fc '[d]okuru_cpu_burn' 2>/dev/null || true"),
		top_processes: commandSync('ps -eo pid,ppid,user,comm | head -12')
	};
}

export function runtimeEvidence(): RuntimeEvidence {
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

export async function runShell(command: unknown): Promise<LabResponse> {
	const safeCommand = String(command || 'id').trim().slice(0, 1000) || 'id';

	try {
		const { stdout, stderr } = await exec(safeCommand, {
			timeout: 5000,
			maxBuffer: 1024 * 1024,
			shell: '/bin/sh'
		});

		return {
			ok: true,
			command: safeCommand,
			output: `${stdout}${stderr}`.slice(0, 14000),
			runtime: runtimeEvidence()
		};
	} catch (error) {
		const typedError = error as ExecError;
		return {
			ok: false,
			command: safeCommand,
			output: `${typedError.stdout || ''}${typedError.stderr || ''}`.slice(0, 14000),
			error: typedError.message,
			runtime: runtimeEvidence()
		};
	}
}

export function spawnPidBomb(count: unknown): LabResponse {
	const requested = clamp(Number(count || 120), 1, 500);
	let spawned = 0;
	const errors: string[] = [];

	for (let index = 0; index < requested; index += 1) {
		try {
			const child = spawn(
				process.execPath,
				['-e', "process.title='dokuru_pid_slp'; setTimeout(() => {}, 60000);"],
				{ detached: true, stdio: 'ignore' }
			);
			child.unref();
			spawned += 1;
		} catch (error) {
			errors.push(
				`spawn failed at ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
			);
			break;
		}
	}

	return {
		ok: true,
		scenario: 'PIDs cgroup pressure',
		requested,
		spawned,
		errors,
		cgroup: cgroupEvidence(),
		cleanup: 'POST /api/cleanup to kill dokuru_pid_slp processes'
	};
}

export function allocateMemory(mb: unknown): LabResponse {
	const requested = clamp(Number(mb || 128), 1, 1024);

	for (let index = 0; index < requested; index += 1) {
		memoryHold.push(Buffer.alloc(1024 * 1024, 'a'));
	}

	return {
		ok: true,
		scenario: 'memory cgroup pressure',
		allocated_mb: requested,
		held_mb: memoryHold.length,
		cgroup: cgroupEvidence()
	};
}

export function burnCpu(seconds: unknown): LabResponse {
	const requested = clamp(Number(seconds || 5), 1, 30);
	const child = spawn(
		process.execPath,
		[
			'-e',
			`process.title='dokuru_cpu_burn'; const crypto = require('node:crypto'); const end = Date.now() + ${requested} * 1000; let ops = 0; while (Date.now() < end) { crypto.createHash('sha256').update(String(ops++)).digest('hex'); }`
		],
		{ detached: true, stdio: 'ignore' }
	);
	child.unref();

	return {
		ok: true,
		scenario: 'CPU cgroup pressure',
		seconds: requested,
		pid: child.pid,
		cgroup: cgroupEvidence()
	};
}

export async function cleanup(): Promise<LabResponse> {
	memoryHold = [];
	return runShell("pkill -f '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep|[d]okuru_cpu_burn' 2>&1 || true");
}

export function health(): LabResponse {
	ensureDataDir();
	const probePath = join(dataDir, 'health-probe.txt');

	const checks = {
		data_dir_exists: existsSync(dataDir),
		data_dir_writable: canWrite(probePath),
		runtime_ready: true
	};

	return {
		ok: !Object.values(checks).includes(false),
		checks,
		runtime: runtimeEvidence()
	};
}

export function probe(): LabResponse {
	ensureDataDir();
	const path = join(dataDir, 'recovery-probe.txt');
	const payload = `probe=${new Date().toISOString()}\n`;
	writeFileSync(path, payload);

	return {
		ok: true,
		file_path: path,
		file_contents: payload.trim(),
		runtime: runtimeEvidence()
	};
}

export async function parseJsonBody<T extends Record<string, unknown>>(
	request: Request
): Promise<Partial<T>> {
	try {
		const value = await request.json();
		return typeof value === 'object' && value !== null ? (value as Partial<T>) : {};
	} catch {
		return {};
	}
}

function commandSync(command: string): string {
	try {
		return execFileSync('/bin/sh', ['-lc', command], { encoding: 'utf8', timeout: 3000 }).trim();
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

function canWrite(path: string): boolean {
	try {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `write=${new Date().toISOString()}\n`);
		return true;
	} catch {
		return false;
	}
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(Math.max(Math.trunc(value), min), max);
}
