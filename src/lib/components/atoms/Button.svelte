<script lang="ts">
	type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'commerce';
	type ButtonSize = 'xs' | 'sm' | 'md';

	type Props = {
		variant?: ButtonVariant;
		size?: ButtonSize;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		onclick?: () => void | Promise<void>;
		children: import('svelte').Snippet;
	};

	let { variant = 'primary', size = 'md', type = 'button', disabled = false, onclick, children }: Props =
		$props();

	const base =
		'inline-flex cursor-pointer items-center justify-center rounded-full font-medium tracking-[0.02em] transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97] active:brightness-95';
	const sizes: Record<ButtonSize, string> = {
		xs: 'px-3 py-1.5 text-[12px]',
		sm: 'px-4 py-2 text-[13px]',
		md: 'px-5 py-2.5 text-[14.5px]'
	};
	const variants: Record<ButtonVariant, string> = {
		primary:
			'bg-playstation-blue text-white hover:bg-[#005fa8] hover:shadow-[0_2px_10px_rgba(0,95,168,0.35)]',
		secondary:
			'border border-[#d0d0d0] bg-white text-ink hover:bg-[#f4f4f4] hover:border-[#b0b0b0] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
		ghost:
			'border border-[#d0d0d0] bg-transparent text-ink hover:bg-[#f0f0f0] hover:border-[#b8b8b8]',
		commerce:
			'bg-commerce text-white hover:bg-[#c5300e] hover:shadow-[0_2px_10px_rgba(197,48,14,0.35)]'
	};
</script>

<button {type} {disabled} {onclick} class={`${base} ${sizes[size]} ${variants[variant]}`}>
	{@render children()}
</button>
