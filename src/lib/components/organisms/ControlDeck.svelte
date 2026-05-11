<script lang="ts">
	import {
		Activity,
		AlertTriangle,
		Boxes,
		CheckCircle2,
		Cpu,
		Database,
		FileSearch,
		Gauge,
		Hash,
		KeySquare,
		Layers,
		LockKeyhole,
		MemoryStick,
		Play,
		Radio,
		RefreshCw,
		RotateCcw,
		ShieldAlert,
		Terminal,
		Upload,
		XCircle,
		Zap
	} from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import type { ActivePayload, CommandPreset, CustomerSample, RuntimeEvidence } from '$lib/types/lab';

	type LabRoute = 'home' | 'monitor' | 'namespace' | 'exploit' | 'cgroup' | 'evidence';
	type UiTheme = 'dark' | 'light';
	type SignalView = 'traffic' | 'resources' | 'namespace' | 'evidence';
	type ActionState = 'running' | 'success' | 'error';
	type ActionStatus = {
		state: ActionState;
		label: string;
		at: string;
		detail?: string;
	};

	type Props = {
		page: LabRoute;
		theme: UiTheme;
		pingHost: string;
		command: string;
		presets: CommandPreset[];
		pidCount: number;
		memoryMb: number;
		cpuSeconds: number;
		busy: boolean;
		running: string;
		activePayload: ActivePayload | null;
		runtime?: RuntimeEvidence;
		evidenceOk: boolean;
		lastUpdated: string;
		terminalConnected: boolean;
		monitorConnected: boolean;
		customerConnected: boolean;
		customerSamples: CustomerSample[];
		actionStatuses: Record<string, ActionStatus>;
		onPingHostChange: (value: string) => void;
		onCommandChange: (value: string) => void;
		onPidCountChange: (value: number) => void;
		onMemoryChange: (value: number) => void;
		onCpuChange: (value: number) => void;
		onRunInjection: () => void | Promise<void>;
		onRunCommand: () => void | Promise<void>;
		onUploadMarker: () => void | Promise<void>;
		onSuidTrap: () => void | Promise<void>;
		onSetcapTrap: () => void | Promise<void>;
		onCleanupTraps: () => void | Promise<void>;
		onPidBomb: () => void | Promise<void>;
		onMemoryBomb: () => void | Promise<void>;
		onCpuBlast: () => void | Promise<void>;
		onStopPayloads: () => void | Promise<void>;
		onCustomerProbe: () => void | Promise<void>;
		onDumpData: () => void | Promise<void>;
		onRansomware: () => void | Promise<void>;
		onRestoreData: () => void | Promise<void>;
		onRefreshEvidence: () => void | Promise<void>;
		onProbeWrite: () => void | Promise<void>;
		onOpenTerminal: () => void;
		onOpenMonitor: () => void;
	};

	let {
		page,
		theme,
		pingHost,
		command,
		presets,
		pidCount,
		memoryMb,
		cpuSeconds,
		busy,
		running,
		activePayload,
		runtime,
		evidenceOk,
		lastUpdated,
		terminalConnected,
		monitorConnected,
		customerConnected,
		customerSamples,
		actionStatuses,
		onPingHostChange,
		onCommandChange,
		onPidCountChange,
		onMemoryChange,
		onCpuChange,
		onRunInjection,
		onRunCommand,
		onUploadMarker,
		onSuidTrap,
		onSetcapTrap,
		onCleanupTraps,
		onPidBomb,
		onMemoryBomb,
		onCpuBlast,
		onStopPayloads,
		onCustomerProbe,
		onDumpData,
		onRansomware,
		onRestoreData,
		onRefreshEvidence,
		onProbeWrite,
		onOpenTerminal,
		onOpenMonitor
	}: Props = $props();

	let signalView = $state<SignalView>('traffic');

	const dark = $derived(theme === 'dark');
	const latestSample = $derived(customerSamples.at(-1));
	const recentSamples = $derived(customerSamples.slice(-30));
	const failedSamples = $derived(recentSamples.filter((sample) => !sample.ok).length);
	const avgLatency = $derived(averageLatency(recentSamples));
	const pidPct = $derived(percent(runtime?.cgroup.pids_current, runtime?.cgroup.pids_max));
	const memPct = $derived(percent(runtime?.cgroup.memory_current, runtime?.cgroup.memory_max));
	const activeBurners = $derived(runtime?.processes.cpu_burners || String(runtime?.cgroup.active_cpu_burners ?? 0));
	const pidSleepers = $derived(processCount(runtime?.processes.pid_bomb_sleepers));
	const memoryHolders = $derived(processCount(runtime?.processes.memory_holders));
	const cpuBurners = $derived(processCount(activeBurners));
	const payloadProcessCount = $derived(pidSleepers + memoryHolders + cpuBurners);
	const hasPayloadActivity = $derived(Boolean(activePayload) || payloadProcessCount > 0);
	const payloadName = $derived(activePayload?.label ?? inferredPayloadLabel());
	const payloadRunDisabled = $derived(busy || hasPayloadActivity || !terminalConnected);
	const stopPayloadDisabled = $derived(!terminalConnected || running === 'stop-payloads' || !hasPayloadActivity);
	const rootMap = $derived(rootMapState());

	$effect(() => {
		signalView = routeToSignal(page);
	});

	const signalTabs: { id: SignalView; label: string; Icon: typeof Activity }[] = [
		{ id: 'traffic', label: 'Latency', Icon: Radio },
		{ id: 'resources', label: 'Resource', Icon: Gauge },
		{ id: 'namespace', label: 'Root Map', Icon: Layers },
		{ id: 'evidence', label: 'Evidence', Icon: FileSearch }
	];

	function routeToSignal(route: LabRoute): SignalView {
		if (route === 'monitor') return 'resources';
		if (route === 'namespace') return 'namespace';
		if (route === 'evidence') return 'evidence';
		return 'traffic';
	}

	function actionStatus(key: string): ActionStatus | null {
		return actionStatuses[key] ?? null;
	}

	function statusText(key: string): string {
		const status = actionStatus(key);
		if (!status) return 'ready';
		if (status.state === 'running') return 'running';
		return `${status.state} · ${status.at}`;
	}

	function statusTone(key: string): string {
		const status = actionStatus(key);
		if (!status) return dark ? 'bg-white/[0.04] text-white/45' : 'bg-black/[0.04] text-black/45';
		if (status.state === 'running') return 'bg-playstation-blue/12 text-playstation-blue';
		if (status.state === 'success') return 'bg-emerald-500/12 text-emerald-500';
		return 'bg-commerce/12 text-commerce';
	}

	function asNumber(value?: string): number | null {
		if (!value || value === 'max' || value === 'unavailable') return null;
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : null;
	}

	function processCount(value?: string): number {
		const parsed = Number.parseInt(value || '0', 10);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	function inferredPayloadLabel(): string {
		if (pidSleepers > 0) return 'PID bomb';
		if (memoryHolders > 0) return 'Memory pressure';
		if (cpuBurners > 0) return 'CPU pressure';
		return 'Payload';
	}

	function isUnlimited(value?: string): boolean {
		const parsed = asNumber(value);
		return !value || value === 'max' || value === 'unavailable' || (parsed !== null && parsed > 1_000_000_000_000_000);
	}

	function percent(current?: string, max?: string): number {
		const currentValue = asNumber(current) ?? 0;
		const maxValue = asNumber(max);
		if (!maxValue || isUnlimited(max)) return 0;
		return Math.min(100, Math.round((currentValue / maxValue) * 100));
	}

	function formatBytes(value?: string): string {
		if (!value || value === 'unavailable') return 'unavailable';
		if (isUnlimited(value)) return 'unlimited';
		const bytes = asNumber(value);
		if (bytes === null) return value;
		const mib = bytes / 1024 / 1024;
		return `${mib.toFixed(mib >= 100 ? 0 : 1)} MiB`;
	}

	function firstLine(value?: string): string {
		return value?.split('\n')[0]?.trim() || 'loading';
	}

	function rootMapState(): { label: string; title: string; detail: string; proof: string; tone: string; safe: boolean } {
		const uid = firstLine(runtime?.uid_map);
		if (/^0\s+0\s+/.test(uid)) {
			return {
				label: 'danger',
				title: 'Container root is host root',
				detail: 'UID 0 in dokuru-lab maps to UID 0 on the host. This is why bind-mount/SUID artifacts are dangerous before the fix.',
				proof: 'Raw UID map starts with 0 0, so root inside the lab is also host root.',
				tone: 'border-commerce/35 bg-commerce/[0.08] text-commerce',
				safe: false
			};
		}
		if (/^0\s+(?!0\b)\d{4,}/.test(uid)) {
			return {
				label: 'isolated',
				title: 'Container root is remapped',
				detail: 'UID 0 in dokuru-lab maps to an unprivileged host UID, so root-owned files inside the container are not host-root files.',
				proof: 'Raw UID map starts with 0 and a non-zero host UID, so root inside the lab is remapped.',
				tone: 'border-emerald-400/35 bg-emerald-400/[0.08] text-emerald-400',
				safe: true
			};
		}
		return {
			label: 'waiting',
			title: 'Waiting for root map',
			detail: 'The monitor has not received the root mapping proof yet.',
			proof: 'Waiting for /proc/self/uid_map from the lab container.',
			tone: dark ? 'border-white/10 bg-white/[0.04] text-white/55' : 'border-black/10 bg-black/[0.03] text-black/55',
			safe: false
		};
	}

	function averageLatency(values: CustomerSample[]): string {
		const ok = values.filter((sample) => sample.ok && Number.isFinite(sample.latency_ms));
		if (ok.length === 0) return '...';
		return `${Math.round(ok.reduce((sum, sample) => sum + sample.latency_ms, 0) / ok.length)}ms`;
	}

	function latencyLabel(sample?: CustomerSample): string {
		if (!sample) return 'waiting';
		return sample.ok ? `${sample.latency_ms}ms` : 'timeout';
	}

	function latencyTone(sample?: CustomerSample): string {
		if (!sample) return dark ? 'text-white/45' : 'text-black/45';
		if (!sample.ok || sample.latency_ms >= 750) return 'text-commerce';
		if (sample.latency_ms >= 250) return 'text-amber-500';
		return 'text-emerald-500';
	}

	function barTone(sample: CustomerSample): string {
		if (!sample.ok || sample.latency_ms >= 750) return 'bg-commerce';
		if (sample.latency_ms >= 250) return 'bg-amber-400';
		return 'bg-playstation-cyan';
	}

	function barHeight(sample: CustomerSample): number {
		if (!sample.ok) return 100;
		return Math.max(8, Math.min(100, Math.round((sample.latency_ms / 1000) * 100)));
	}

	function cardClass(emphasis = false): string {
		if (dark) {
			return emphasis
				? 'border-commerce/35 bg-commerce/[0.055] text-white shadow-[0_16px_36px_rgba(0,0,0,0.32)]'
				: 'border-white/8 bg-white/[0.025] text-white shadow-[0_16px_36px_rgba(0,0,0,0.24)]';
		}

		return emphasis
			? 'border-commerce/25 bg-white text-black shadow-[0_12px_28px_rgba(213,59,0,0.08)]'
			: 'border-black/6 bg-white text-black shadow-[0_12px_28px_rgba(0,0,0,0.06)]';
	}

	function muted(): string {
		return dark ? 'text-white/55' : 'text-black/55';
	}

	function inputClass(): string {
		return dark
			? 'border-white/10 bg-black/45 text-white placeholder:text-white/25 focus:border-playstation-blue focus:ring-playstation-blue/30'
			: 'border-black/10 bg-white text-black placeholder:text-black/30 focus:border-playstation-blue focus:ring-playstation-blue/20';
	}
</script>

<section
	id="control-deck"
	class={`scroll-mt-16 px-4 py-10 sm:px-6 md:px-8 lg:py-14 ${
		dark ? 'bg-[#050505] text-white' : 'bg-[#f6f8fb] text-black'
	}`}
>
	<div class="mx-auto max-w-[1480px]">
		<header class="mb-6 flex flex-col justify-between gap-4 @4xl/main:flex-row @4xl/main:items-end">
			<div>
				<p class={`m-0 mb-2 font-mono text-[11px] tracking-[0.14em] uppercase ${dark ? 'text-white/45' : 'text-black/45'}`}>
					Control deck
				</p>
				<h2 class="m-0 text-[clamp(28px,3.8vw,48px)] leading-tight font-light tracking-[-0.03em]">
					Run attack, watch signal, keep proof in terminal.
				</h2>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onclick={onOpenTerminal}
					class={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition ${
						dark
							? 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white'
							: 'border-black/10 bg-white text-black/75 hover:border-playstation-blue/35 hover:text-playstation-blue'
					}`}
				>
					<Terminal size={14} strokeWidth={1.8} /> Terminal
				</button>
				<button
					type="button"
					onclick={onOpenMonitor}
					class={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition ${
						dark
							? 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white'
							: 'border-black/10 bg-white text-black/75 hover:border-playstation-blue/35 hover:text-playstation-blue'
					}`}
				>
					<Activity size={14} strokeWidth={1.8} /> Side monitor
				</button>
			</div>
		</header>

		<div class="grid gap-4 @5xl/main:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
			<section id="exploit" class={`rounded-[28px] border p-4 @lg/main:p-5 ${cardClass()}`}>
				<div class="mb-4 flex flex-col justify-between gap-3 @2xl/main:flex-row @2xl/main:items-center">
					<div>
						<p class={`m-0 mb-1 font-mono text-[10.5px] tracking-[0.14em] uppercase ${muted()}`}>Attack pad</p>
						<h3 class="m-0 text-[22px] font-light tracking-tight">One viewport for the whole demo</h3>
					</div>
					{#if hasPayloadActivity}
						<div class="inline-flex items-center gap-2 rounded-full border border-commerce/20 bg-commerce/10 px-3 py-1.5 text-[12px] text-commerce">
							<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-commerce" aria-hidden="true"></span>
							<span class="font-mono">{payloadName}</span>
						</div>
					{/if}
				</div>

				<div class="grid gap-3">
					<article class={`rounded-2xl border p-4 ${cardClass(true)}`}>
						<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
							<div class="flex min-w-0 items-center gap-3">
								<span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-commerce/15 text-commerce" aria-hidden="true">
									<Terminal size={18} strokeWidth={1.7} />
								</span>
								<div class="min-w-0">
									<h4 class="m-0 text-[15px] font-semibold">A0 Command Injection</h4>
									<p class={`m-0 mt-0.5 text-[12.5px] ${muted()}`}>Entry point. Output goes to terminal.</p>
								</div>
							</div>
							<span class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] ${statusTone('ping')}`}>
								{@render statusGlyph('ping', 11)} {statusText('ping')}
							</span>
						</div>
						<div class="grid gap-2 @2xl/main:grid-cols-[minmax(0,1fr)_auto]">
							<input
								value={pingHost}
								oninput={(event) => onPingHostChange(event.currentTarget.value)}
								class={`min-h-10 rounded-full border px-4 font-mono text-[12.5px] transition focus:ring-2 focus:outline-none ${inputClass()}`}
								aria-label="Command injection payload"
							/>
							<Button size="xs" variant="commerce" onclick={onRunInjection} disabled={busy}>Execute</Button>
						</div>
					</article>

					<div class="grid gap-3 @xl/main:grid-cols-3">
						{@render actionCard('upload', 'B1', 'Bind marker', Upload, 'Write marker', onUploadMarker, false)}
						{@render actionCard('suid-trap', 'B2', 'SUID trap', ShieldAlert, 'Plant SUID', onSuidTrap, true)}
						{@render actionCard('setcap-trap', 'B3', 'Setcap trap', KeySquare, 'Plant setcap', onSetcapTrap, false)}
					</div>

					<div id="cgroup" class={`rounded-2xl border p-4 ${cardClass()}`}>
						<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
							<div>
								<p class={`m-0 mb-1 font-mono text-[10.5px] tracking-[0.14em] uppercase ${muted()}`}>Resource pressure</p>
								<h4 class="m-0 text-[16px] font-semibold tracking-tight">Trigger resource pressure and watch Resource/Traffic</h4>
							</div>
							<Button size="xs" variant="commerce" onclick={onStopPayloads} disabled={stopPayloadDisabled}>Stop payload</Button>
						</div>
						{#if hasPayloadActivity}
							<p class={`m-0 mb-3 text-[12px] ${muted()}`}>Resource payload is active. Start buttons are locked until Stop payload finishes.</p>
						{:else}
							<p class={`m-0 mb-3 text-[12px] ${muted()}`}>No payload is active. Stop payload stays disabled until a pressure run starts.</p>
						{/if}

						<div class="grid gap-3 @2xl/main:grid-cols-3">
							{@render pressureCard('pid-bomb', 'PIDs', Hash, `${pidCount}`, 'sleepers', pidCount, 1, 500, onPidCountChange, onPidBomb, payloadRunDisabled)}
							{@render pressureCard('memory-bomb', 'Memory', MemoryStick, `${memoryMb} MB`, 'hold', memoryMb, 1, 3500, onMemoryChange, onMemoryBomb, payloadRunDisabled)}
							{@render pressureCard('cpu-blast', 'CPU blast', Cpu, `${cpuSeconds}s`, 'miners', cpuSeconds, 5, 90, onCpuChange, onCpuBlast, payloadRunDisabled)}
						</div>
					</div>

					<div class="grid gap-3 @xl/main:grid-cols-[1.2fr_0.8fr]">
						<article id="namespace" class={`rounded-2xl border p-4 ${cardClass()}`}>
							<div class="mb-3 flex items-center justify-between gap-3">
								<div class="flex items-center gap-3">
									<span class="grid h-9 w-9 place-items-center rounded-xl bg-playstation-blue/12 text-playstation-blue" aria-hidden="true">
										<Layers size={17} strokeWidth={1.7} />
									</span>
									<div>
										<h4 class="m-0 text-[15px] font-semibold">Root mapping proof</h4>
										<p class={`m-0 mt-0.5 text-[12.5px] ${muted()}`}>Run exact command, read output in terminal.</p>
									</div>
								</div>
								<span class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] ${statusTone('exec')}`}>
									{@render statusGlyph('exec', 11)} {statusText('exec')}
								</span>
							</div>
							<div class="mb-2 flex flex-wrap gap-1.5">
								{#each presets as preset (preset.label)}
									<button
										type="button"
										onclick={() => onCommandChange(preset.command)}
										class={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition ${
											dark ? 'border-white/10 text-white/50 hover:text-white' : 'border-black/10 text-black/50 hover:text-black'
										}`}
									>
										{preset.label}
									</button>
								{/each}
							</div>
							<textarea
								value={command}
								oninput={(event) => onCommandChange(event.currentTarget.value)}
								class={`mb-2.5 min-h-20 w-full resize-y rounded-xl border px-3 py-2 font-mono text-[12px] transition focus:ring-2 focus:outline-none ${inputClass()}`}
								aria-label="Root-map command"
							></textarea>
							<Button size="xs" onclick={onRunCommand} disabled={busy}>Run command</Button>
						</article>

						<article class={`rounded-2xl border p-4 ${cardClass()}`}>
							<div class="mb-3 flex items-center gap-3">
								<span class="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/12 text-amber-500" aria-hidden="true">
									<Database size={17} strokeWidth={1.7} />
								</span>
								<div>
									<h4 class="m-0 text-[15px] font-semibold">App data scope</h4>
									<p class={`m-0 mt-0.5 text-[12.5px] ${muted()}`}>Honest boundary: still app-layer impact.</p>
								</div>
							</div>
							<div class="grid gap-2">
								<Button size="xs" onclick={onDumpData} disabled={busy}>Dump sample data</Button>
								<Button size="xs" variant="commerce" onclick={onRansomware} disabled={busy}>Encrypt customer files</Button>
								<Button size="xs" onclick={onRestoreData} disabled={busy}>
									<span class="inline-flex items-center gap-1.5"><RotateCcw size={13} strokeWidth={2} /> Restore data</span>
								</Button>
							</div>
						</article>
					</div>

					<div class="flex flex-wrap items-center justify-between gap-3">
						<Button size="xs" onclick={onCleanupTraps} disabled={busy}>Cleanup SUID/setcap</Button>
						<Button size="xs" onclick={onCustomerProbe} disabled={busy}>Probe protected API</Button>
					</div>
				</div>
			</section>

			<aside id="signals" class={`rounded-[28px] border p-4 @lg/main:p-5 @5xl/main:sticky @5xl/main:top-[72px] @5xl/main:self-start ${cardClass()}`}>
				<div class="mb-4 flex flex-col gap-3">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class={`m-0 mb-1 font-mono text-[10.5px] tracking-[0.14em] uppercase ${muted()}`}>Live signal</p>
							<h3 class="m-0 text-[22px] font-light tracking-tight">{signalTabs.find((tab) => tab.id === signalView)?.label}</h3>
						</div>
						<span class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] ${monitorConnected ? 'bg-emerald-500/12 text-emerald-500' : 'bg-commerce/12 text-commerce'}`}>
							<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
							{monitorConnected ? lastUpdated || 'live' : 'reconnect'}
						</span>
					</div>

					<div class="flex gap-1.5 overflow-x-auto pb-1">
						{#each signalTabs as tab (tab.id)}
							{@const TabIcon = tab.Icon}
							<button
								type="button"
								onclick={() => (signalView = tab.id)}
								class={`inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap transition ${
									signalView === tab.id
										? 'border-playstation-blue bg-playstation-blue text-white'
										: dark
											? 'border-white/10 bg-white/[0.035] text-white/55 hover:text-white'
											: 'border-black/10 bg-white text-black/55 hover:text-black'
								}`}
							>
								<TabIcon size={11} strokeWidth={1.8} /> {tab.label}
							</button>
						{/each}
					</div>
				</div>

				{#if signalView === 'traffic'}
					{@render trafficSignal()}
				{:else if signalView === 'resources'}
					{@render resourceSignal()}
				{:else if signalView === 'namespace'}
					{@render namespaceSignal()}
				{:else}
					{@render evidenceSignal()}
				{/if}
			</aside>
		</div>
	</div>
</section>

{#snippet actionCard(key: string, code: string, title: string, Icon: typeof Activity, buttonLabel: string, action: () => void | Promise<void>, emphasis: boolean)}
	<article class={`rounded-2xl border p-4 ${cardClass(emphasis)}`}>
		<div class="mb-3 flex items-start justify-between gap-3">
			<div class="flex min-w-0 items-center gap-3">
				<span class={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${emphasis ? 'bg-commerce/15 text-commerce' : 'bg-playstation-blue/12 text-playstation-blue'}`} aria-hidden="true">
					<Icon size={17} strokeWidth={1.7} />
				</span>
				<div class="min-w-0">
					<p class={`m-0 font-mono text-[10px] ${muted()}`}>{code}</p>
					<h4 class="m-0 truncate text-[14px] font-semibold">{title}</h4>
				</div>
			</div>
			<span class={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] ${statusTone(key)}`}>
				{@render statusGlyph(key, 10)} {statusText(key)}
			</span>
		</div>
		<Button size="xs" variant={emphasis ? 'commerce' : 'primary'} onclick={action} disabled={busy}>{buttonLabel}</Button>
	</article>
{/snippet}

{#snippet pressureCard(key: string, title: string, Icon: typeof Activity, valueLabel: string, unitLabel: string, value: number, min: number, max: number, onChange: (value: number) => void, action: () => void | Promise<void>, disabled = false)}
	<article class={`rounded-xl border p-3 ${dark ? 'border-white/8 bg-black/20' : 'border-black/6 bg-black/[0.02]'}`}>
		<div class="mb-2 flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<span class="grid h-7 w-7 place-items-center rounded-lg bg-playstation-blue/12 text-playstation-blue" aria-hidden="true">
					<Icon size={14} strokeWidth={1.7} />
				</span>
				<div>
					<h5 class="m-0 text-[13px] font-semibold">{title}</h5>
					<p class={`m-0 font-mono text-[10px] ${muted()}`}>{valueLabel} {unitLabel}</p>
				</div>
			</div>
			<span class={actionStatus(key)?.state === 'error' ? 'text-commerce' : actionStatus(key)?.state === 'success' ? 'text-emerald-500' : muted()}>
				{@render statusGlyph(key, 13)}
			</span>
		</div>
		<input
			type="range"
			min={min}
			max={max}
			value={value}
			disabled={disabled}
			oninput={(event) => onChange(Number(event.currentTarget.value))}
			class="mb-3 w-full accent-playstation-blue disabled:cursor-not-allowed disabled:opacity-45"
		/>
		<Button size="xs" onclick={action} {disabled}>{title === 'CPU blast' ? 'Start blast' : `Run ${title}`}</Button>
	</article>
{/snippet}

{#snippet statusGlyph(key: string, size: number)}
	{#if actionStatus(key)?.state === 'success'}
		<CheckCircle2 {size} strokeWidth={1.8} />
	{:else if actionStatus(key)?.state === 'error'}
		<XCircle {size} strokeWidth={1.8} />
	{:else}
		<Play {size} strokeWidth={1.8} />
	{/if}
{/snippet}

{#snippet metricRow(label: string, value: string, pct = 0, tone = 'bg-playstation-blue', detail = '')}
	<div class={`rounded-2xl border p-4 ${dark ? 'border-white/8 bg-white/[0.025]' : 'border-black/6 bg-white'}`}>
		<div class="mb-3 flex items-center justify-between gap-3">
			<span class={`font-mono text-[10.5px] tracking-[0.12em] uppercase ${muted()}`}>{label}</span>
			<strong class="font-mono text-[13px] tabular-nums">{value}</strong>
		</div>
		<div class={`h-2 overflow-hidden rounded-full ${dark ? 'bg-white/10' : 'bg-black/8'}`}>
			<div class={`h-full rounded-full transition-all duration-500 ${tone}`} style={`width: ${pct}%`}></div>
		</div>
		{#if detail}
			<p class={`m-0 mt-2 text-[11.5px] leading-snug ${muted()}`}>{detail}</p>
		{/if}
	</div>
{/snippet}

{#snippet trafficSignal()}
	<div class="grid gap-3">
		<div class={`rounded-[24px] border p-5 ${dark ? 'border-white/8 bg-[#061826]' : 'border-black/6 bg-[#eef7ff]'}`}>
			<div class="mb-5 flex items-start justify-between gap-4">
				<div>
					<p class={`m-0 mb-1 inline-flex items-center gap-2 text-[12px] ${dark ? 'text-white/55' : 'text-black/55'}`}>
						<span class={`h-1.5 w-1.5 rounded-full ${customerConnected ? 'bg-emerald-400' : 'bg-commerce'}`} aria-hidden="true"></span>
						Protected Checkout API
					</p>
					<strong class={`block text-[48px] leading-none font-light tracking-[-0.04em] tabular-nums ${latencyTone(latestSample)}`}>{latencyLabel(latestSample)}</strong>
				</div>
				<span class={`rounded-full px-3 py-1 font-mono text-[10.5px] ${customerConnected ? 'bg-emerald-500/12 text-emerald-500' : 'bg-commerce/12 text-commerce'}`}>
					{customerConnected ? 'streaming' : 'offline'}
				</span>
			</div>
			<div class={`flex h-32 items-end gap-1 rounded-2xl p-2 ${dark ? 'bg-black/35' : 'bg-white/70'}`} aria-label="Customer latency bars">
				{#if recentSamples.length === 0}
					<div class={`grid h-full w-full place-items-center text-[13px] ${muted()}`}>waiting for checkout monitor</div>
				{/if}
				{#each recentSamples as sample}
					<div class={`min-w-1 flex-1 rounded-t ${barTone(sample)}`} style={`height: ${barHeight(sample)}%`} title={sample.ok ? `${sample.latency_ms}ms` : sample.error || 'failed'}></div>
				{/each}
			</div>
			{#if hasPayloadActivity}
				<p class={`m-0 mt-3 text-[11.5px] leading-relaxed ${muted()}`}>If this stays green during {payloadName}, isolation is working: the pressure is scoped to <code>dokuru-lab</code>, while checkout runs in a separate protected container.</p>
			{/if}
		</div>
		<div class="grid grid-cols-3 gap-2">
			{@render miniStat('avg', avgLatency)}
			{@render miniStat('fail', String(failedSamples))}
			{@render miniStat('samples', String(recentSamples.length))}
		</div>
	</div>
{/snippet}

{#snippet resourceSignal()}
	<div class="grid gap-3">
		{@render metricRow('Processes in lab', `${runtime?.cgroup.pids_current || '—'} / ${runtime?.cgroup.pids_max || '—'}`, pidPct, 'bg-playstation-blue', 'Current process count versus the PID limit for dokuru-lab only.')}
		{@render metricRow('Memory in lab', `${formatBytes(runtime?.cgroup.memory_current)} / ${formatBytes(runtime?.cgroup.memory_max)}`, memPct, 'bg-playstation-cyan', 'cgroup memory.current versus memory.max for dokuru-lab.')}
		{@render metricRow('CPU stress workers', activeBurners, Number(activeBurners) > 0 ? 100 : 0, 'bg-commerce', 'Active CPU burner processes started by this demo.')}
		<div class={`rounded-2xl border p-4 ${dark ? 'border-white/8 bg-white/[0.025]' : 'border-black/6 bg-white'}`}>
			<p class={`m-0 mb-3 font-mono text-[10.5px] tracking-[0.12em] uppercase ${muted()}`}>Raw cgroup proof</p>
			<dl class="grid gap-2 font-mono text-[11px]">
				<div class="flex justify-between gap-3"><dt class={muted()}>CPU quota file</dt><dd class="m-0 text-right">{runtime?.cgroup.cpu_max || 'loading'}</dd></div>
				<div class="flex justify-between gap-3"><dt class={muted()}>CPU weight file</dt><dd class="m-0 text-right">{runtime?.cgroup.cpu_weight || 'loading'}</dd></div>
				<div class="flex justify-between gap-3"><dt class={muted()}>PID sleepers</dt><dd class="m-0 text-right">{runtime?.processes.pid_bomb_sleepers || '0'}</dd></div>
				<div class="flex justify-between gap-3"><dt class={muted()}>Memory holders</dt><dd class="m-0 text-right">{runtime?.processes.memory_holders || '0'}</dd></div>
			</dl>
		</div>
	</div>
{/snippet}

{#snippet namespaceSignal()}
	<div class={`rounded-[24px] border p-5 ${dark ? 'border-white/8 bg-white/[0.025]' : 'border-black/6 bg-white'}`}>
		<div class="mb-4 flex items-start justify-between gap-3">
			<div class="flex items-center gap-3">
				<span class="grid h-10 w-10 place-items-center rounded-xl bg-playstation-blue/12 text-playstation-blue" aria-hidden="true">
					<Boxes size={18} strokeWidth={1.7} />
				</span>
				<div>
					<h4 class="m-0 text-[15px] font-semibold">{rootMap.title}</h4>
					<p class={`m-0 mt-0.5 max-w-[30rem] text-[12.5px] leading-relaxed ${muted()}`}>{rootMap.detail}</p>
				</div>
			</div>
			<span class={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${rootMap.tone}`}>{rootMap.label}</span>
		</div>
		<div class={`mb-4 rounded-2xl border p-3 ${rootMap.tone}`}>
			<p class="m-0 font-mono text-[11px] leading-relaxed">
				{rootMap.proof}
			</p>
		</div>
		<dl class="grid gap-3">
			{@render proofLine('raw UID map', firstLine(runtime?.uid_map))}
			{@render proofLine('raw GID map', firstLine(runtime?.gid_map))}
			{@render proofLine('user namespace ID', runtime?.user_namespace || 'loading')}
			{@render proofLine('PID namespace ID', runtime?.pid_namespace || 'loading')}
			{@render proofLine('processes visible here', `${runtime?.processes.process_count || 'loading'} inside dokuru-lab`)}
		</dl>
	</div>
{/snippet}

{#snippet evidenceSignal()}
	<div id="evidence" class="grid gap-3">
		<div class={`rounded-[24px] border p-5 ${dark ? 'border-white/8 bg-white/[0.025]' : 'border-black/6 bg-white'}`}>
			<div class="mb-4 flex items-start justify-between gap-3">
				<div>
					<p class={`m-0 mb-1 font-mono text-[10.5px] tracking-[0.12em] uppercase ${muted()}`}>Snapshot</p>
					<h4 class="m-0 text-[24px] font-light tracking-tight">{evidenceOk ? 'Evidence ready' : 'Need refresh'}</h4>
				</div>
				<span class={`rounded-full px-3 py-1 font-mono text-[10.5px] ${evidenceOk ? 'bg-emerald-500/12 text-emerald-500' : 'bg-commerce/12 text-commerce'}`}>
					{lastUpdated || 'no sample'}
				</span>
			</div>
			<dl class="mb-4 grid gap-3">
				{@render proofLine('user', runtime?.id || 'loading')}
				{@render proofLine('cpu.max', runtime?.cgroup.cpu_max || 'loading')}
				{@render proofLine('memory.max', formatBytes(runtime?.cgroup.memory_max))}
			</dl>
			<div class="flex flex-wrap gap-2">
				<Button size="xs" onclick={onRefreshEvidence} disabled={running === 'health'}>
					<span class="inline-flex items-center gap-1.5"><RefreshCw size={13} strokeWidth={1.7} /> Refresh</span>
				</Button>
				<Button size="xs" onclick={onProbeWrite} disabled={busy}>Probe write</Button>
			</div>
		</div>
		<div class={`rounded-2xl border p-4 ${dark ? 'border-white/8 bg-white/[0.025]' : 'border-black/6 bg-white'}`}>
			<div class="flex items-start gap-3">
				<AlertTriangle size={16} strokeWidth={1.7} class="mt-0.5 shrink-0 text-amber-500" />
				<p class={`m-0 text-[12.5px] leading-relaxed ${muted()}`}>Before/after proof is the same UI and same buttons. Only host Docker state changes.</p>
			</div>
		</div>
	</div>
{/snippet}

{#snippet miniStat(label: string, value: string)}
	<div class={`rounded-2xl border p-3 ${dark ? 'border-white/8 bg-white/[0.025]' : 'border-black/6 bg-white'}`}>
		<p class={`m-0 font-mono text-[10px] tracking-[0.12em] uppercase ${muted()}`}>{label}</p>
		<strong class="mt-2 block font-mono text-[15px] tabular-nums">{value}</strong>
	</div>
{/snippet}

{#snippet proofLine(label: string, value: string)}
	<div class={`grid gap-1 border-b pb-2 last:border-b-0 last:pb-0 ${dark ? 'border-white/8' : 'border-black/6'}`}>
		<dt class={`font-mono text-[10px] tracking-[0.12em] uppercase ${muted()}`}>{label}</dt>
		<dd class="m-0 break-words font-mono text-[12px] leading-relaxed">{value}</dd>
	</div>
{/snippet}
