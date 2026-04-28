<script lang="ts">
	type Props = {
		label: string;
		value: string;
		dark?: boolean;
	};

	let { label, value, dark = false }: Props = $props();
</script>

<div class={dark ? 'rounded-xl bg-white/10 p-5 text-white' : 'rounded-xl bg-ice p-4 text-ink'}>
	<span class={dark ? 'mb-2 block text-[13px] font-medium text-[#cccccc]' : 'mb-2 block text-[13px] font-medium text-body-gray'}>{label}</span>
	<strong class="block break-words font-mono text-[13px] leading-relaxed font-semibold">{value}</strong>
</div>
