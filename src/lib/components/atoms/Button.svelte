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
		'inline-flex items-center justify-center rounded-full font-bold tracking-[0.14px] transition duration-180 ease-out disabled:cursor-wait disabled:opacity-55';
	const sizes: Record<ButtonSize, string> = {
		sm: 'px-3.5 py-2 text-[13px]',
		md: 'px-5 py-2.5 text-[15px]'
	};
	const variants: Record<ButtonVariant, string> = {
		primary:
			'bg-playstation-blue text-white hover:scale-[1.08] hover:bg-playstation-cyan hover:outline-2 hover:outline-white hover:ring-2 hover:ring-playstation-blue',
		secondary:
			'border-2 border-black bg-white text-playstation-blue hover:scale-[1.08] hover:bg-playstation-cyan hover:text-white hover:outline-2 hover:outline-white hover:ring-2 hover:ring-playstation-blue',
		ghost:
			'border border-[#dedede] bg-transparent text-ink hover:scale-[1.08] hover:bg-playstation-cyan hover:text-white hover:outline-2 hover:outline-white hover:ring-2 hover:ring-playstation-blue',
		commerce:
			'bg-commerce text-white hover:scale-[1.08] hover:bg-playstation-cyan hover:outline-2 hover:outline-white hover:ring-2 hover:ring-playstation-blue active:bg-[#aa2f00]'
	};
</script>

<button {type} {disabled} {onclick} class={`${base} ${sizes[size]} ${variants[variant]}`}>
	{@render children()}
</button>
