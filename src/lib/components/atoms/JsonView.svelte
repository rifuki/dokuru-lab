<script lang="ts">
	type Props = {
		value: unknown;
		maxHeight?: string;
		class?: string;
	};

	let { value, maxHeight = 'max-h-72', class: className = '' }: Props = $props();

	function stringify(input: unknown): string {
		try {
			return JSON.stringify(input, null, 2);
		} catch {
			return String(input);
		}
	}

	const json = $derived(stringify(value));

	// Highlight tokens into colored spans
	const highlighted = $derived(highlightJson(json));

	function highlightJson(text: string): string {
		return text.replace(
			/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,
			(match, stringOrKey, colon, bool, number) => {
				if (stringOrKey) {
					if (colon) {
						return `<span class="text-playstation-cyan">${escapeHtml(stringOrKey)}</span>${colon}`;
					}
					return `<span class="text-emerald-400">${escapeHtml(stringOrKey)}</span>`;
				}
				if (bool) {
					return `<span class="text-[#c9a7ff]">${bool}</span>`;
				}
				if (number) {
					return `<span class="text-[#ffd479]">${number}</span>`;
				}
				return match;
			}
		);
	}

	function escapeHtml(input: string): string {
		return input
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;');
	}
</script>

<pre class={`m-0 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/5 bg-black/40 px-3 py-2 font-mono text-[11.5px] leading-[1.55] text-white/80 ${maxHeight} ${className}`}>{@html highlighted}</pre>
