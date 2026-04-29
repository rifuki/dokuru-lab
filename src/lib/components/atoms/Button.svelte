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
		'inline-flex items-center justify-center rounded-full tracking-[0.4px] transition-all duration-[180ms] ease-out disabled:cursor-wait disabled:opacity-55 active:opacity-60';
	const sizes: Record<ButtonSize, string> = {
		sm: 'px-4 py-2 text-[14px]',
		md: 'px-6 py-3 text-[18px]'
	};
	const variants: Record<ButtonVariant, string> = {
		primary:
			'bg-playstation-blue text-white font-medium hover:scale-[1.2] hover:bg-playstation-cyan hover:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0070cc] focus-visible:bg-playstation-cyan focus-visible:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0070cc]',
		secondary:
			'border-[2px] border-black border-outset bg-white text-playstation-blue font-semibold hover:scale-[1.2] hover:bg-playstation-cyan hover:text-white hover:border-transparent hover:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0070cc]',
		ghost:
			'border border-[#dedede] bg-transparent text-ink font-medium hover:scale-[1.2] hover:bg-playstation-cyan hover:text-white hover:border-transparent hover:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0070cc] active:text-[#0072ce]',
		commerce:
			'bg-commerce text-white font-bold tracking-[0.45px] hover:scale-[1.2] hover:bg-playstation-cyan hover:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0070cc] active:bg-commerce-active'
	};
</script>

<button {type} {disabled} {onclick} class={`${base} ${sizes[size]} ${variants[variant]}`}>
	{@render children()}
</button>
