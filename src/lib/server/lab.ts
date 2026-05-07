import { exec as execCallback, execFileSync, spawn } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readlinkSync,
	readdirSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { CgroupEvidence, LabResponse, ProcessEvidence, RuntimeEvidence } from '$lib/types/lab';

const exec = promisify(execCallback);
const dataDir = process.env.LAB_DATA_DIR || '/app/data';
const uploadDir = process.env.LAB_UPLOAD_DIR || '/app/uploads';
const logDir = process.env.LAB_LOG_DIR || '/app/logs';
const ransomwareKeyPath = process.env.LAB_RANSOMWARE_KEY_PATH || '/tmp/dokuru-lab-baseline-ransomware-key.txt';
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
	const requested = clamp(Number(mb || 128), 1, 1536);

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

export async function uploadDemoFile(file: File): Promise<LabResponse> {
	mkdirSync(uploadDir, { recursive: true });
	const target = join(uploadDir, file.name || `upload-${Date.now()}`);
	const bytes = Buffer.from(await file.arrayBuffer());

	writeFileSync(target, bytes, { mode: 0o755 });

	return {
		ok: true,
		scenario: 'baseline bind-mount upload',
		saved: target,
		size: bytes.length,
		mode: '0755',
		owner: commandSync(`stat -c '%u:%g %A %n' ${shellQuote(target)} 2>/dev/null || ls -lan ${shellQuote(target)}`),
		runtime: runtimeEvidence()
	};
}

export async function pingHost(host: unknown): Promise<LabResponse> {
	const value = String(host || '127.0.0.1').trim().slice(0, 500) || '127.0.0.1';
	return runShell(`ping -c 1 ${value}`);
}

export function stress(type: unknown, duration: unknown): LabResponse {
	const kind = String(type || 'cpu');
	const seconds = clamp(Number(duration || 15), 1, 30);

	if (kind === 'fork' || kind === 'pid') {
		return spawnPidBomb(Math.max(80, seconds * 12));
	}

	if (kind === 'memory') {
		return allocateMemory(200);
	}

	return burnCpu(seconds);
}

export function triggerCron(): LabResponse {
	mkdirSync(uploadDir, { recursive: true });
	mkdirSync(logDir, { recursive: true });
	const marker = join(uploadDir, '.trigger-cron');
	writeFileSync(marker, `triggered_at=${new Date().toISOString()}\n`);

	return {
		ok: true,
		scenario: 'mock host cron trigger',
		trigger_file: marker,
		message: 'Host-level lab-baseline-cron.timer should process uploaded .sh payloads from the bind mount.',
		uploaded_scripts: listFiles(uploadDir, (name) => name.endsWith('.sh')),
		runtime: runtimeEvidence()
	};
}

export function ransomwareStrike(): LabResponse {
	const targetDir = join(uploadDir, 'customer-data');
	seedCustomerFiles(targetDir);
	const key = `dokuru-demo-key-${Date.now()}`;
	const encrypted: string[] = [];

	for (const path of walkFiles(targetDir)) {
		if (path.endsWith('.locked') || path.endsWith('RANSOM_NOTE.txt')) continue;
		const content = readFileSync(path);
		const payload = Buffer.from(content.toString('base64').split('').reverse().join(''));
		writeFileSync(`${path}.locked`, payload);
		renameSync(path, `${path}.bak`);
		encrypted.push(`${path}.locked`);
	}

	writeFileSync(ransomwareKeyPath, `${key}\n`);
	writeFileSync(
		join(targetDir, 'RANSOM_NOTE.txt'),
		[
			'DOKURU BASELINE DEMO',
			'Customer files were encrypted by a controlled lab payload.',
			`Encrypted files: ${encrypted.length}`,
			`Recovery key path: ${ransomwareKeyPath}`,
			''
		].join('\n')
	);

	return {
		ok: true,
		scenario: 'controlled ransomware strike',
		target_dir: targetDir,
		encrypted_count: encrypted.length,
		key_path: ransomwareKeyPath,
		sample: encrypted.slice(0, 10)
	};
}

export function resetExploitState(): LabResponse {
	const targetDir = join(uploadDir, 'customer-data');
	let restored = 0;

	for (const path of walkFiles(targetDir)) {
		if (path.endsWith('.bak')) {
			const original = path.slice(0, -4);
			renameSync(path, original);
			restored += 1;
		}
	}

	for (const path of walkFiles(targetDir)) {
		if (path.endsWith('.locked') || path.endsWith('RANSOM_NOTE.txt')) {
			try {
				unlinkSync(path);
			} catch {
				// Best-effort cleanup keeps reset robust during demos.
			}
		}
	}

	return {
		ok: true,
		scenario: 'demo reset',
		restored_files: restored,
		remaining_customer_files: listFiles(targetDir).length,
		runtime: runtimeEvidence()
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

function seedCustomerFiles(targetDir: string): void {
	mkdirSync(targetDir, { recursive: true });
	if (listFiles(targetDir, (name) => name.endsWith('.txt') || name.endsWith('.json')).length > 0) {
		return;
	}

	for (let index = 1; index <= 200; index += 1) {
		const id = String(index).padStart(4, '0');
		writeFileSync(
			join(targetDir, `customer-${id}.json`),
			JSON.stringify(
				{
					id,
					name: `Demo Customer ${id}`,
					email: `customer${id}@example.test`,
					balance: index * 17,
					created_at: new Date().toISOString()
				},
				null,
				2
			)
		);
	}

	for (let index = 1; index <= 30; index += 1) {
		const id = String(index).padStart(3, '0');
		writeFileSync(join(targetDir, `invoice-${id}.txt`), `Invoice ${id}\nAmount: ${index * 91_000}\n`);
	}
}

function walkFiles(root: string): string[] {
	if (!existsSync(root)) return [];
	const output: string[] = [];
	for (const entry of readdirSync(root)) {
		const path = join(root, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) output.push(...walkFiles(path));
		else output.push(path);
	}
	return output;
}

function listFiles(root: string, filter: (name: string) => boolean = () => true): string[] {
	if (!existsSync(root)) return [];
	return readdirSync(root)
		.filter(filter)
		.map((name) => join(root, name));
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}
