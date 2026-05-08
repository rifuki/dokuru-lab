import { readFileSync, readlinkSync } from 'node:fs';
import type { CgroupEvidence, ProcessEvidence, RuntimeEvidence } from '../lib/types/lab';
import { commandSync } from './shell';

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

export function cgroupEvidence(): CgroupEvidence {
	// Count active CPU burners
	let activeBurners = 0;
	try {
		const count = commandSync("ps aux | grep '[d]okuru_cpu_burn' | wc -l");
		activeBurners = parseInt(count) || 0;
	} catch {
		activeBurners = 0;
	}
	
	return {
		pids_current: readFirst(['/sys/fs/cgroup/pids.current', '/sys/fs/cgroup/pids/pids.current']),
		pids_max: readFirst(['/sys/fs/cgroup/pids.max', '/sys/fs/cgroup/pids/pids.max']),
		memory_current: readFirst(['/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory/memory.usage_in_bytes']),
		memory_max: readFirst(['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']),
		cpu_weight: readFirst(['/sys/fs/cgroup/cpu.weight']),
		cpu_max: readFirst(['/sys/fs/cgroup/cpu.max']),
		cpu_shares_v1: readFirst(['/sys/fs/cgroup/cpu/cpu.shares']),
		active_cpu_burners: activeBurners
	};
}

export function cgroupSummary(): string {
	const cgroup = cgroupEvidence();
	return `pids.current=${cgroup.pids_current} pids.max=${cgroup.pids_max} memory.current=${cgroup.memory_current} memory.max=${cgroup.memory_max} cpu.weight=${cgroup.cpu_weight}\n`;
}

export function memorySummary(): string {
	const cgroup = cgroupEvidence();
	return `memory.current=${cgroup.memory_current} memory.max=${cgroup.memory_max}`;
}

export function readFirst(paths: string[]): string {
	for (const path of paths) {
		try {
			return readFileSync(path, 'utf8').trim();
		} catch {}
	}
	return 'unavailable';
}

function processEvidence(): ProcessEvidence {
	return {
		process_count: commandSync("ps -eo pid= | wc -l | tr -d ' '"),
		pid_bomb_sleepers: commandSync("pgrep -fc '[d]okuru_pid_slp|[d]okuru_pid_bomb_sleep' 2>/dev/null || true"),
		cpu_burners: commandSync("pgrep -fc '[d]okuru_cpu_burn' 2>/dev/null || true"),
		top_processes: commandSync('ps -eo pid,ppid,user,comm | head -12')
	};
}

function namespaceLink(path: string): string {
	try {
		return readlinkSync(path);
	} catch {
		return 'unavailable';
	}
}
