<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';

	type Props = {
		onRefresh: () => void | Promise<void>;
		running: boolean;
	};

	let { onRefresh, running }: Props = $props();
</script>

<nav class="sticky top-0 z-20 bg-black text-white" aria-label="Primary">
	<div class="mx-auto flex max-w-[1540px] items-center justify-between gap-6 px-4 py-3 md:px-16">
		<a class="inline-flex items-center gap-2.5 text-[15px] font-semibold text-white no-underline" href="/" aria-label="Dokuru Lab home">
			<span class="grid h-7 w-7 place-items-center rounded-full bg-white font-bold text-playstation-blue">D</span>
			<span>Dokuru Lab</span>
		</a>

		<div class="hidden items-center gap-6 text-sm font-medium md:flex">
			<a class="text-white no-underline transition hover:text-[#1883fd]" href="#namespace">Namespace</a>
			<a class="text-white no-underline transition hover:text-[#1883fd]" href="#cgroup">Cgroup</a>
			<a class="text-white no-underline transition hover:text-[#1883fd]" href="#evidence">Evidence</a>
		</div>

		<Button variant="secondary" size="sm" onclick={onRefresh} disabled={running}>Refresh evidence</Button>
	</div>
</nav>
