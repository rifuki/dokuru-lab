<script lang="ts">
	import Panel from '$lib/components/molecules/Panel.svelte';
</script>

<Panel title="Before / after proof" subtitle="Screenshot guide" class="@4xl/main:col-span-7">
	<p class="m-0 mb-4 text-sm leading-relaxed text-body-gray">
		Use these exact changes as the explanation slide. The app remains vulnerable; the container boundary changes.
	</p>
	<table class="w-full border-collapse text-left text-[13px] leading-relaxed">
		<tbody>
			<tr class="border-b border-divider"><th class="w-24 py-2.5 pr-3 font-bold text-ink">UID map</th><td class="py-2.5 text-body-gray">Before: <code>0 0</code>. After: remapped host UID range.</td></tr>
			<tr class="border-b border-divider"><th class="w-24 py-2.5 pr-3 font-bold text-ink">PID view</th><td class="py-2.5 text-body-gray">Before: host process list. After: only container processes.</td></tr>
			<tr class="border-b border-divider"><th class="w-24 py-2.5 pr-3 font-bold text-ink">PIDs</th><td class="py-2.5 text-body-gray">Before: many sleepers spawn. After: <code>pids.max</code> caps the bomb.</td></tr>
			<tr class="border-b border-divider"><th class="w-24 py-2.5 pr-3 font-bold text-ink">Memory</th><td class="py-2.5 text-body-gray">Before: unlimited or host-sized. After: explicit memory limit.</td></tr>
			<tr class="border-b border-divider"><th class="w-24 py-2.5 pr-3 font-bold text-ink">CPU</th><td class="py-2.5 text-body-gray">Before: default shares. After: explicit CPU shares/weight.</td></tr>
		</tbody>
	</table>

	<div class="mt-4 grid gap-2 rounded-xl bg-ice p-3.5">
		<span class="text-[13px] font-medium text-body-gray">Inspect baseline</span>
		<code class="break-words font-mono text-xs text-ink">docker inspect dokuru-lab</code>
	</div>
</Panel>
