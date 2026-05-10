<script lang="ts">
	import { ChevronLeft, GripVertical, Terminal } from '@lucide/svelte';

	type Props = {
		open: boolean;
		width: number;
		minWidth: number;
		maxWidth: number;
		connected: boolean;
		busy: boolean;
		lineCount: number;
		onToggle: () => void;
		onResize: (next: number) => void;
		onResizeEnd: () => void;
	};

	let {
		open,
		width,
		minWidth,
		maxWidth,
		connected,
		busy,
		lineCount,
		onToggle,
		onResize,
		onResizeEnd
	}: Props = $props();

	let pointerId = $state<number | null>(null);
	let dragStartX = 0;
	let dragStartWidth = 0;
	let dragMoved = false;

	const dotClass = $derived(
		connected ? (busy ? 'bg-playstation-cyan animate-pulse' : 'bg-emerald-400') : 'bg-commerce'
	);

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		pointerId = event.pointerId;
		dragStartX = event.clientX;
		dragStartWidth = width;
		dragMoved = false;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		if (open) {
			document.body.style.userSelect = 'none';
			document.body.style.cursor = 'col-resize';
		}
	}

	function onPointerMove(event: PointerEvent) {
		if (pointerId !== event.pointerId) return;
		const dx = event.clientX - dragStartX;
		if (Math.abs(dx) > 4) dragMoved = true;
		if (!open) return;
		const next = Math.max(minWidth, Math.min(maxWidth, dragStartWidth - dx));
		onResize(next);
	}

	function onPointerUp(event: PointerEvent) {
		if (pointerId !== event.pointerId) return;
		(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		const wasDrag = dragMoved && open;
		pointerId = null;
		dragMoved = false;
		if (wasDrag) {
			onResizeEnd();
		} else {
			onToggle();
		}
	}

	function onPointerCancel() {
		pointerId = null;
		dragMoved = false;
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onToggle();
		} else if (open && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
			event.preventDefault();
			const step = event.shiftKey ? 32 : 16;
			const dir = event.key === 'ArrowLeft' ? 1 : -1;
			const next = Math.max(minWidth, Math.min(maxWidth, width + dir * step));
			onResize(next);
			onResizeEnd();
		}
	}

	const buttonClass = $derived(!open && busy ? 'bg-playstation-blue shadow-[0_0_15px_rgba(0,112,204,0.6)] animate-pulse' : 'bg-black shadow-[0_5px_9px_rgba(0,0,0,0.16)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.2)]');
</script>

<div
	class="pointer-events-none fixed top-0 right-0 z-30 hidden h-screen lg:block"
	style="transform: translateX(-{open ? width : 0}px); transition: {pointerId === null
		? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
		: 'none'};"
	aria-hidden="true"
>
	<!-- Resize handle: Only active when open -->
	{#if open}
		<button
			type="button"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerCancel}
			onkeydown={onKeyDown}
			aria-label="Resize terminal sidebar"
			aria-pressed="true"
			title="Drag to resize"
			class="group pointer-events-auto absolute top-0 right-0 flex h-full w-2 cursor-col-resize touch-none items-center justify-center bg-transparent outline-none"
		>
			<!-- Hairline track -->
			<span
				class="pointer-events-none absolute top-0 right-0 h-full w-px bg-white/10 transition-colors duration-150 group-hover:bg-white/40"
				aria-hidden="true"
			></span>
			<!-- Grip pill: visible on hover -->
			<span
				class="pointer-events-none relative grid h-12 w-5 -translate-x-px place-items-center rounded-full bg-white/10 text-white/70 opacity-0 transition-all duration-200 group-hover:opacity-100"
				aria-hidden="true"
			>
				<GripVertical size={12} strokeWidth={2.2} />
			</span>
		</button>
	{/if}

	<!-- Always visible "Terminal" toggle tab attached to right edge -->
	<button
		type="button"
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointercancel={onPointerCancel}
		onkeydown={onKeyDown}
		aria-label={open ? "Close terminal sidebar" : "Open terminal sidebar"}
		aria-pressed={open}
		title={open ? "Close terminal" : "Open terminal"}
		class="group pointer-events-auto absolute top-1/2 right-0 flex h-auto -translate-y-1/2 cursor-pointer touch-none flex-col items-center gap-2 rounded-l-[12px] px-2.5 py-3.5 text-white outline-none transition-all duration-200 ease-out hover:bg-playstation-blue hover:px-3 focus-visible:bg-playstation-blue {buttonClass}"
	>
		<Terminal size={15} strokeWidth={2} />
		<!-- Vertical "terminal" label -->
		<span
			class="font-mono text-[10.5px] tracking-[0.08em] text-white/85 [writing-mode:vertical-rl] [text-orientation:mixed]"
		>
			terminal
		</span>
		<!-- Status dot -->
		<span
			class={`mt-1 inline-block h-1.5 w-1.5 rounded-full transition-colors ${dotClass}`}
			aria-hidden="true"
		></span>
		<!-- Line count badge (only if any) -->
		{#if lineCount > 0}
			<span
				class={`mt-0.5 min-w-[20px] rounded-full px-1.5 py-0.5 text-center font-mono text-[9.5px] font-bold tabular-nums transition-all duration-300 ${
					!open
						? 'animate-pulse bg-playstation-blue text-white shadow-[0_0_8px_rgba(0,112,204,0.7)]'
						: 'bg-white/15 text-white/85 group-hover:bg-white/25'
				}`}
			>
				{lineCount > 99 ? '99+' : lineCount}
			</span>
		{/if}
		<!-- Chevron hint -->
		<ChevronLeft size={11} strokeWidth={2.4} class="mt-1 opacity-60 transition-transform duration-300 group-hover:opacity-100 {open ? 'rotate-180' : ''}" />
	</button>
</div>
