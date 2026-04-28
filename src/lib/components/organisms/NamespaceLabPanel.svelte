<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';
	import OutputPanel from '$lib/components/molecules/OutputPanel.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { CommandPreset } from '$lib/types/lab';

	type Props = {
		command: string;
		presets: CommandPreset[];
		output: string;
		running: string;
		onCommandChange: (value: string) => void;
		onRun: () => void | Promise<void>;
	};

	let {
		command,
		presets,
		output,
		running,
		onCommandChange,
		onRun
	}: Props = $props();
</script>

<Panel id="namespace" title="Namespace proof" subtitle="Rules 2.10, 5.16, 5.17, 5.21, 5.31" class="lg:col-span-8">
	<div class="grid gap-3 md:grid-cols-3">
		<div class="rounded-xl border border-divider bg-ice p-4">
			<strong class="block text-sm text-ink">UID remap</strong>
			<p class="m-0 mt-2 text-xs leading-relaxed text-body-gray"><code>uid_map</code> starts as <code>0 0</code>. After Dokuru userns-remap, root maps to a host subuid.</p>
		</div>
		<div class="rounded-xl border border-divider bg-ice p-4">
			<strong class="block text-sm text-ink">PID namespace</strong>
			<p class="m-0 mt-2 text-xs leading-relaxed text-body-gray">Before hardening, host processes are visible. After the fix, the process list is container-scoped.</p>
		</div>
		<div class="rounded-xl border border-divider bg-ice p-4">
			<strong class="block text-sm text-ink">Namespace links</strong>
			<p class="m-0 mt-2 text-xs leading-relaxed text-body-gray">Compare <code>/proc/self/ns/*</code> before and after Dokuru recreates the container.</p>
		</div>
	</div>

	<div class="mt-4 rounded-xl border border-divider p-4">
		<label class="mb-2 block text-sm font-bold text-ink" for="command">Run proof command inside the vulnerable container</label>
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
		<Button onclick={onRun} disabled={running === 'exec'}>Run command</Button>
	</div>

	<OutputPanel title="Namespace command result" content={output} />
</Panel>
