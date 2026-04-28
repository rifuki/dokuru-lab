<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';
	import Field from '$lib/components/atoms/Field.svelte';
	import OutputPanel from '$lib/components/molecules/OutputPanel.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';
	import type { CommandPreset } from '$lib/types/lab';

	type Props = {
		url: string;
		command: string;
		presets: CommandPreset[];
		output: string;
		running: string;
		onUrlChange: (value: string) => void;
		onCommandChange: (value: string) => void;
		onFetch: () => void | Promise<void>;
		onRun: () => void | Promise<void>;
	};

	let {
		url,
		command,
		presets,
		output,
		running,
		onUrlChange,
		onCommandChange,
		onFetch,
		onRun
	}: Props = $props();
</script>

<Panel id="namespace" title="Namespace exposure" subtitle="Rules 2.10, 5.10, 5.16, 5.31" class="lg:col-span-8">
	<div class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
		<div class="rounded-xl border border-divider p-3.5">
			<Field id="url" label="SSRF URL" value={url} oninput={onUrlChange} />
			<div class="mt-2.5">
				<Button onclick={onFetch} disabled={running === 'fetch'}>Fetch URL</Button>
			</div>
			<p class="mt-2.5 text-[13px] leading-relaxed text-body-gray">
				Use the network-host compose file, then fetch host loopback at <code>127.0.0.1:9999</code>.
			</p>
		</div>

		<div class="rounded-xl border border-divider p-3.5">
			<label class="mb-2 block text-sm font-bold text-ink" for="command">Command execution</label>
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
	</div>

	<OutputPanel content={output} />
</Panel>
