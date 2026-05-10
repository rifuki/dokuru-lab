<script lang="ts">
	import { Layers, Link2, Terminal as TerminalIcon, UserCog } from '@lucide/svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { CommandPreset } from '$lib/types/lab';

	type Props = {
		command: string;
		presets: CommandPreset[];
		running: string;
		onCommandChange: (value: string) => void;
		onRun: () => void | Promise<void>;
	};

	let {
		command,
		presets,
		running,
		onCommandChange,
		onRun
	}: Props = $props();
</script>

<Panel title="Namespace proof" subtitle="Rules 2.10, 5.16, 5.17, 5.21, 5.31">
	<div class="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
		<article class="relative overflow-hidden rounded-2xl border border-transparent bg-white p-5 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_15px_rgba(0,0,0,0.08)] hover:ring-black/10">
			<div class="mb-3 flex items-center gap-3">
				<span class="grid h-10 w-10 place-items-center rounded-xl bg-playstation-blue/10 text-playstation-blue transition-colors group-hover:bg-playstation-blue/15" aria-hidden="true">
					<UserCog size={18} strokeWidth={1.5} />
				</span>
				<strong class="text-[14px] font-semibold tracking-wide text-ink">UID remap</strong>
			</div>
			<p class="m-0 text-[13px] leading-relaxed text-body-gray"><code>uid_map</code> starts as <code>0 0</code>. After Dokuru userns-remap, root maps to a host subuid.</p>
		</article>
		<article class="relative overflow-hidden rounded-2xl border border-transparent bg-white p-5 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_15px_rgba(0,0,0,0.08)] hover:ring-black/10">
			<div class="mb-3 flex items-center gap-3">
				<span class="grid h-10 w-10 place-items-center rounded-xl bg-playstation-cyan/15 text-[#0e7fa8] transition-colors" aria-hidden="true">
					<Layers size={18} strokeWidth={1.5} />
				</span>
				<strong class="text-[14px] font-semibold tracking-wide text-ink">PID namespace</strong>
			</div>
			<p class="m-0 text-[13px] leading-relaxed text-body-gray">Before hardening, host processes are visible. After the fix, the process list is container-scoped.</p>
		</article>
		<article class="relative overflow-hidden rounded-2xl border border-transparent bg-white p-5 shadow-[0_5px_9px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_15px_rgba(0,0,0,0.08)] hover:ring-black/10">
			<div class="mb-3 flex items-center gap-3">
				<span class="grid h-10 w-10 place-items-center rounded-xl bg-[#9ad7ff]/20 text-[#0e7fa8] transition-colors" aria-hidden="true">
					<Link2 size={18} strokeWidth={1.5} />
				</span>
				<strong class="text-[14px] font-semibold tracking-wide text-ink">Namespace links</strong>
			</div>
			<p class="m-0 text-[13px] leading-relaxed text-body-gray">Compare <code>/proc/self/ns/*</code> before and after Dokuru recreates the container.</p>
		</article>
	</div>

	<div class="mt-4 rounded-[12px] border border-divider p-4">
		<label class="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink" for="command">
			<TerminalIcon size={13} strokeWidth={2.2} class="text-body-gray" />
			Run proof command inside the vulnerable container
		</label>
		<div class="mb-2.5 flex flex-wrap gap-2">
			{#each presets as preset}
				<Button variant="ghost" size="sm" onclick={() => onCommandChange(preset.command)}>{preset.label}</Button>
			{/each}
		</div>
		<textarea
			id="command"
			value={command}
			oninput={(event) => onCommandChange(event.currentTarget.value)}
			class="mb-2.5 min-h-24 w-full resize-y rounded-[3px] border border-[#cccccc] bg-white px-3 py-2.5 font-mono text-[13px] text-ink transition focus:ring-2 focus:ring-playstation-blue focus:outline-none"
		></textarea>
		<Button onclick={onRun} disabled={Boolean(running)}>Run command</Button>
	</div>
</Panel>
