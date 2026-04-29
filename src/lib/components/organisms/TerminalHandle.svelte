<script lang="ts">
	import { ChevronLeft } from '@lucide/svelte';

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
		document.body.style.userSelect = 'none';
		document.body.style.cursor = open ? 'col-resize' : 'pointer';
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
</script>

<div
	class="pointer-events-none fixed top-0 right-0 z-30 hidden h-screen lg:block"
	style="transform: translateX(-{open ? width : 0}px); transition: {pointerId === null ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'};"
	aria-hidden="true"
>
	<button
		type="button"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerCancel}
		onkeydown={onKeyDown}
		aria-label={open ? 'Close terminal sidebar (drag to resize)' : 'Open terminal sidebar'}
		aria-pressed={open}
		title={open ? 'Click to close · drag to resize' : 'Open terminal'}
		class="group pointer-events-auto absolute top-1/2 right-0 flex h-20 w-3.5 -translate-y-1/2 cursor-col-resize touch-none items-center justify-center bg-transparent outline-none transition-all duration-150"
	>
		<!-- Hairline track (always visible, thin, subtle) -->
		<span
			class="pointer-events-none absolute top-0 right-0 h-full w-px transition-colors duration-150 {open
				? 'bg-white/10 group-hover:bg-white/30'
				: 'bg-black/10 group-hover:bg-black/40'}"
			aria-hidden="true"
		></span>

		<!-- Grip pill (the visible click target) -->
		<span
			class="pointer-events-none relative flex h-14 w-3 flex-col items-center justify-center gap-1 rounded-full transition-all duration-200 group-hover:scale-110 group-hover:shadow-[0_5px_9px_rgba(0,0,0,0.16)] {open
				? 'bg-white/15 group-hover:bg-white/25'
				: 'bg-black group-hover:bg-playstation-blue'}"
			aria-hidden="true"
		>
			<!-- Two grip dots -->
			<span class="block h-1 w-1 rounded-full {open ? 'bg-white/60' : 'bg-white/70'}"></span>
			<span class="block h-1 w-1 rounded-full {open ? 'bg-white/60' : 'bg-white/70'}"></span>
		</span>

		<!-- Status badge that pops out on hover when closed -->
		{#if !open}
			<span
				class="pointer-events-none absolute top-1/2 right-full mr-2 flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-black px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.06em] text-white opacity-0 shadow-[0_5px_9px_rgba(0,0,0,0.16)] transition-opacity duration-150 group-hover:opacity-100"
			>
				<span class={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true"></span>
				<span>terminal</span>
				{#if lineCount > 0}
					<span class="rounded-full bg-white/15 px-1.5 py-px text-[9.5px] text-white/80">{lineCount > 99 ? '99+' : lineCount}</span>
				{/if}
			</span>
		{/if}

		<!-- Chevron that flips by state -->
		<span
			class="pointer-events-none absolute top-1/2 right-1/2 grid -translate-y-1/2 translate-x-1/2 place-items-center text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
			aria-hidden="true"
		>
			<ChevronLeft
				size={11}
				strokeWidth={2.4}
				class="transition-transform duration-200 {open ? 'rotate-180' : ''}"
			/>
		</span>
	</button>
</div>
