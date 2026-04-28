<script lang="ts">
	type Props = {
		content: string;
		minHeight?: string;
	};

	let { content, minHeight = 'min-h-[170px]' }: Props = $props();
</script>

<pre class={`${minHeight} mt-4 max-h-[430px] overflow-auto rounded-xl bg-black p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-white`}>{content}</pre>
