<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';
	import Panel from '$lib/components/molecules/Panel.svelte';

	type Props = {
		running: string;
		onCustomerProbe: () => void | Promise<void>;
		onCpuBlast: () => void | Promise<void>;
		onMemoryBlast: () => void | Promise<void>;
		onStealSecrets: () => void | Promise<void>;
		onSabotageProxy: () => void | Promise<void>;
	};

	let {
		running,
		onCustomerProbe,
		onCpuBlast,
		onMemoryBlast,
		onStealSecrets,
		onSabotageProxy
	}: Props = $props();

	const busy = $derived(Boolean(running));
</script>

<Panel id="blast-radius" title="Blast-radius scenarios" subtitle="Lab v2" class="lg:col-span-7">
	<div class="mb-4 rounded-xl border border-commerce/20 bg-[#fff4ef] p-4">
		<strong class="block text-sm text-ink">Demo story</strong>
		<p class="m-0 mt-2 text-sm leading-relaxed text-body-gray">
			Semua tombol ini jalan dari container <code>dokuru-lab</code>, lalu dampaknya dilihat di terminal dan Customer Live View. Setelah Dokuru fix, tombol yang sama harus gagal atau dampaknya terkurung di attacker container.
		</p>
	</div>

	<div class="grid gap-3 md:grid-cols-2">
		<div class="rounded-xl border border-divider p-4">
			<span class="block text-sm font-bold text-ink">Baseline customer</span>
			<p class="min-h-12 text-sm leading-relaxed text-body-gray">Probe manual ke checkout tetangga untuk bukti awal bahwa customer sehat.</p>
			<Button variant="ghost" onclick={onCustomerProbe} disabled={busy}>Probe checkout</Button>
		</div>

		<div class="rounded-xl border border-divider p-4">
			<span class="block text-sm font-bold text-ink">B1 Cryptominer</span>
			<p class="min-h-12 text-sm leading-relaxed text-body-gray">Spawn 4 CPU miners. Sebelum CPU hardening, latency customer naik.</p>
			<Button onclick={onCpuBlast} disabled={busy}>Deploy cryptominer</Button>
		</div>

		<div class="rounded-xl border border-divider p-4">
			<span class="block text-sm font-bold text-ink">B2 Memory blast</span>
			<p class="min-h-12 text-sm leading-relaxed text-body-gray">Alokasi 1280 MiB di attacker. Setelah mem_limit, attacker yang OOM, bukan tetangga.</p>
			<Button onclick={onMemoryBlast} disabled={busy}>Trigger memory blast</Button>
		</div>

		<div class="rounded-xl border border-divider p-4">
			<span class="block text-sm font-bold text-ink">B3 Secret theft</span>
			<p class="min-h-12 text-sm leading-relaxed text-body-gray">Cari PID postgres tetangga lalu baca <code>/proc/&lt;pid&gt;/environ</code>.</p>
			<Button variant="commerce" onclick={onStealSecrets} disabled={busy}>Steal neighbor secrets</Button>
		</div>

		<div class="rounded-xl border border-divider p-4 md:col-span-2">
			<span class="block text-sm font-bold text-ink">B4 Reverse-proxy sabotage</span>
			<p class="min-h-12 text-sm leading-relaxed text-body-gray">
				Mengirim <code>SIGSTOP</code> ke proses caddy host, lalu auto-resume beberapa detik setelahnya. Pakai sebagai cadangan karena UI bisa disconnect sementara.
			</p>
			<Button variant="commerce" onclick={onSabotageProxy} disabled={busy}>Stop caddy briefly</Button>
		</div>
	</div>
</Panel>
