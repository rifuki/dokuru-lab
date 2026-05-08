<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import LabPage from '$lib/components/templates/LabPage.svelte';

	let { children } = $props();

	function routeToLabPage(pathname: string) {
		const normalized = pathname.replace(/\/$/, '') || '/';
		if (normalized === '/monitor') return 'monitor';
		if (normalized === '/namespace') return 'namespace';
		if (normalized === '/exploit') return 'exploit';
		if (normalized === '/cgroup') return 'cgroup';
		if (normalized === '/evidence') return 'evidence';
		return 'home';
	}

	function routeTitle(route: ReturnType<typeof routeToLabPage>): string {
		if (route === 'home') return 'Dokuru Namespace Cgroup Lab';
		return `${route[0].toUpperCase()}${route.slice(1)} | Dokuru Lab Baseline`;
	}

	const activeLabPage = $derived(routeToLabPage(page.url.pathname));
	const title = $derived(routeTitle(activeLabPage));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{title}</title>
	<meta
		name="description"
		content="A clickable SvelteKit lab for validating Docker namespace isolation and cgroup controls."
	/>
</svelte:head>

<LabPage page={activeLabPage} />
{@render children()}
