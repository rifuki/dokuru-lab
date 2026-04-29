<script lang="ts">
	import { FlaskConical } from '@lucide/svelte';

	type Props = {
		monitorConnected: boolean;
		monitorLastUpdated: string;
	};

	let { monitorConnected, monitorLastUpdated }: Props = $props();
</script>

<nav class="sticky top-0 z-30 border-b border-white/5 bg-black text-white" aria-label="Primary">
	<div class="mx-auto flex max-w-[1540px] items-center justify-between gap-6 px-4 py-3 sm:px-6 md:px-8">
		<a class="inline-flex items-center gap-2.5 text-[15px] font-semibold text-white no-underline" href="/" aria-label="Dokuru Lab home">
			<span class="grid h-7 w-7 place-items-center rounded-full bg-white text-playstation-blue" aria-hidden="true">
				<FlaskConical size={14} strokeWidth={2.2} />
			</span>
			<span>Dokuru Lab</span>
			<span class="hidden rounded-full border border-white/12 px-2 py-[2px] font-mono text-[10px] tracking-[0.04em] text-white/55 @md/page:inline">v2 &middot; namespace + cgroup</span>
		</a>

		<div class="flex items-center gap-5 text-[13px] font-medium">
			<div class="hidden items-center gap-5 @4xl/page:flex">
				<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#monitor">Monitor</a>
				<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#scenarios">Scenarios</a>
				<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#namespace">Namespace</a>
				<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#cgroup">Cgroup</a>
				<a class="text-white/85 no-underline transition hover:text-[#1883fd]" href="#evidence">Evidence</a>
			</div>
		</div>
	</div>
</nav>
