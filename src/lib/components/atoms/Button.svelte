<script lang="ts">
	type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'commerce';
	type ButtonSize = 'sm' | 'md';

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
		'inline-flex cursor-pointer items-center justify-center rounded-full tracking-[0.02em] transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 active:scale-95';
	const sizes: Record<ButtonSize, string> = {
		sm: 'px-4 py-2 text-[13px]',
		md: 'px-5 py-2.5 text-[14.5px]'
	};
	const variants: Record<ButtonVariant, string> = {
		primary:
			'bg-playstation-blue text-white font-medium hover:-translate-y-0.5 hover:bg-[#1eaedb] hover:shadow-[0_4px_12px_rgba(30,174,219,0.35)]',
		secondary:
			'border border-[#d0d0d0] bg-white text-ink font-medium hover:-translate-y-0.5 hover:border-playstation-blue hover:text-playstation-blue hover:shadow-[0_4px_12px_rgba(0,112,204,0.12)]',
		ghost:
			'border border-[#d0d0d0] bg-transparent text-ink font-medium hover:-translate-y-0.5 hover:border-[#b0b0b0] hover:bg-black/[0.04] hover:text-ink',
		commerce:
			'bg-commerce text-white font-medium hover:-translate-y-0.5 hover:bg-[#d63118] hover:shadow-[0_4px_12px_rgba(230,55,27,0.35)] active:bg-[#b02813]'
	};
</script>

<button {type} {disabled} {onclick} class={`${base} ${sizes[size]} ${variants[variant]}`}>
	{@render children()}
</button>
