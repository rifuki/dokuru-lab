export type CgroupEvidence = {
	pids_current: string;
	pids_max: string;
	memory_current: string;
	memory_max: string;
	cpu_weight: string;
	cpu_max: string;
	cpu_shares_v1: string;
};

export type RuntimeEvidence = {
	id: string;
	uid_map: string;
	gid_map: string;
	pid_namespace: string;
	user_namespace: string;
	uts_namespace: string;
	cgroup: CgroupEvidence;
};

export type LabResponse = {
	ok: boolean;
	error?: string;
	runtime?: RuntimeEvidence;
	cgroup?: CgroupEvidence;
	[key: string]: unknown;
};

export type CommandPreset = {
	label: string;
	command: string;
};
