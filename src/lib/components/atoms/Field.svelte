<script lang="ts">
	type Props = {
		id: string;
		label: string;
		type?: 'text' | 'number';
		min?: number;
		max?: number;
		value: string | number;
		oninput: (value: string) => void;
	};

	let { id, label, type = 'text', min, max, value, oninput }: Props = $props();
</script>

<label class="grid gap-1.5 text-sm font-bold text-ink" for={id}>
	<span>{label}</span>
	<input
		{id}
		{type}
		{min}
		{max}
		value={String(value)}
		oninput={(event) => oninput(event.currentTarget.value)}
		class="w-full rounded-[3px] border border-[#cccccc] bg-white px-3 py-2.5 text-[15px] text-ink shadow-none transition focus:ring-2 focus:ring-playstation-blue focus:outline-none"
	/>
</label>
