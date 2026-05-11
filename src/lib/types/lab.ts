export type CgroupEvidence = {
	pids_current: string;
	pids_max: string;
	memory_current: string;
	memory_max: string;
	cpu_weight: string;
	cpu_max: string;
	cpu_shares_v1: string;
	active_cpu_burners: number;
};

export type ProcessEvidence = {
	process_count: string;
	pid_bomb_sleepers: string;
	memory_holders: string;
	cpu_burners: string;
	top_processes: string;
};

export type RuntimeEvidence = {
	id: string;
	uid_map: string;
	gid_map: string;
	pid_namespace: string;
	user_namespace: string;
	uts_namespace: string;
	cgroup: CgroupEvidence;
	processes: ProcessEvidence;
};

export type HostResourceInfo = {
	cpu_cores: number;
	cpu_usage_percent: number;
	memory_total_gb: number;
	memory_available_gb: number;
	memory_total_mib?: number;
	memory_available_mib?: number;
	memory_used_mib?: number;
	memory_source?: string;
};

export type LabResponse = {
	ok: boolean;
	error?: string;
	runtime?: RuntimeEvidence;
	cgroup?: CgroupEvidence;
	[key: string]: unknown;
};

export type ActivePayload = {
	type: string;
	label: string;
	startedAt: string;
	expiresAt?: string;
};

export type CustomerSample = {
	ok: boolean;
	status: number | string;
	latency_ms: number;
	url?: string;
	source?: string;
	observed_at?: string;
	body?: string;
	error?: string;
};

export type CommandPreset = {
	label: string;
	command: string;
};
