<script lang="ts">
	type Props = {
		id?: string;
		title: string;
		subtitle?: string;
		class?: string;
		children: import('svelte').Snippet;
	};

	let { id, title, subtitle, class: className = '', children }: Props = $props();
</script>

<article {id} class={`animate-panel-in scroll-mt-24 rounded-2xl bg-white p-6 shadow-[rgba(0,0,0,0.06)_0_5px_9px_0] ring-1 ring-black/5 ${className}`}>
	<div class="mb-5 flex items-start justify-between gap-4 border-b border-black/5 pb-4">
		<h2 class="m-0 text-[26px] tracking-tight font-light text-black">{title}</h2>
		{#if subtitle}
			<span class="text-right text-[13px] font-medium text-body-gray">{subtitle}</span>
		{/if}
	</div>
	{@render children()}
</article>
