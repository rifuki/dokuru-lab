<script lang="ts">
	import { Check, CircleDashed, LoaderCircle, X } from '@lucide/svelte';

	type Status = 'idle' | 'running' | 'ok' | 'error';

	type Props = {
		status: Status;
		text?: string;
	};

	let { status, text }: Props = $props();

	const icons = {
		idle: CircleDashed,
		running: LoaderCircle,
		ok: Check,
		error: X
	} as const;

	const classes = {
		idle: 'text-white/35 bg-white/5',
		running: 'text-playstation-cyan bg-playstation-cyan/10 animate-pulse',
		ok: 'text-emerald-500 bg-emerald-500/10',
		error: 'text-commerce bg-commerce/10'
	} as const;

	const Icon = $derived(icons[status]);
</script>

<span class={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10.5px] tracking-[0.02em] ${classes[status]}`}>
	<Icon size={10} strokeWidth={2.2} class={status === 'running' ? 'animate-spin' : ''} />
	<span>{text || status}</span>
</span>
