<script lang="ts">
	type Status = 'healthy' | 'warning' | 'critical';
	type Props = {
		status: Status;
	};

	let { status }: Props = $props();

	const colors: Record<Status, string> = {
		healthy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
		warning: 'bg-amber-100 text-amber-700 border-amber-200',
		critical: 'bg-red-100 text-red-700 border-red-200'
	};

	const icons: Record<Status, string> = {
		healthy: '🟢',
		warning: '⚠️',
		critical: '🔴'
	};
</script>

<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${colors[status]}`}>
	<span aria-hidden="true" class="text-[10px] leading-none">{icons[status]}</span>
	{status}
</span>
