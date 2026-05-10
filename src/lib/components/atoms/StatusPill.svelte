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
		idle: 'text-body-gray bg-slate-100',
		running: 'text-playstation-cyan bg-playstation-cyan/10',
		ok: 'text-emerald-600 bg-emerald-50',
		error: 'text-commerce bg-commerce/10'
	} as const;

	const Icon = $derived(icons[status]);
</script>

<span class={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.02em] ${classes[status]}`}>
	<Icon size={10} strokeWidth={2.2} class={status === 'running' ? 'animate-spin' : ''} />
	<span>{text || status}</span>
</span>
