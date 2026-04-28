<script lang="ts">
	import Panel from '$lib/components/molecules/Panel.svelte';
</script>

<Panel title="Expected proof" subtitle="Before vs after" class="lg:col-span-4">
	<table class="w-full border-collapse text-left text-[13px] leading-relaxed">
		<tbody>
			<tr class="border-b border-divider"><th class="w-20 py-2.5 pr-3 font-bold text-ink">PID view</th><td class="py-2.5 text-body-gray">Host processes disappear</td></tr>
			<tr class="border-b border-divider"><th class="w-20 py-2.5 pr-3 font-bold text-ink">UID map</th><td class="py-2.5 text-body-gray"><code>0 0</code> becomes a remapped UID</td></tr>
			<tr class="border-b border-divider"><th class="w-20 py-2.5 pr-3 font-bold text-ink">PIDs</th><td class="py-2.5 text-body-gray"><code>pids.max</code> changes from max</td></tr>
			<tr class="border-b border-divider"><th class="w-20 py-2.5 pr-3 font-bold text-ink">Memory</th><td class="py-2.5 text-body-gray"><code>memory.max</code> becomes a limit</td></tr>
			<tr class="border-b border-divider"><th class="w-20 py-2.5 pr-3 font-bold text-ink">CPU</th><td class="py-2.5 text-body-gray"><code>CpuShares</code> becomes explicit</td></tr>
		</tbody>
	</table>

	<div class="mt-4 grid gap-2 rounded-xl bg-ice p-3.5">
		<span class="text-[13px] font-medium text-body-gray">Inspect baseline</span>
		<code class="break-words font-mono text-xs text-ink">docker inspect dokuru-lab</code>
	</div>
</Panel>
