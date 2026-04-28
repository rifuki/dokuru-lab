<script lang="ts">
	type Props = {
		content: string;
		title?: string;
		open?: boolean;
	};

	let { content, title = 'Raw response', open = false }: Props = $props();
</script>

<details {open} class="mt-4 overflow-hidden rounded-xl border border-divider bg-black text-white">
	<summary class="cursor-pointer list-none px-4 py-3 text-sm font-bold text-white marker:hidden">
		{title}
	</summary>
	<pre class="max-h-[330px] overflow-auto border-t border-white/10 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-white">{content}</pre>
</details>
