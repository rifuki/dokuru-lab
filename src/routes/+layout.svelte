<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import LabPage from '$lib/components/templates/LabPage.svelte';

	let { children } = $props();

	const title = $derived.by(() => {
		const pathname = page.url.pathname.replace(/\/$/, '') || '/';
		if (pathname === '/') return 'Dokuru Namespace & Cgroup Lab';
		const slug = pathname.slice(1);
		return `${slug[0].toUpperCase()}${slug.slice(1)} | Dokuru Lab`;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{title}</title>
	<meta
		name="description"
		content="A SvelteKit lab for validating Docker namespace isolation and cgroup controls. Single-page dashboard with live attack primitives and real-time signals."
	/>
</svelte:head>

<LabPage />
{@render children()}
