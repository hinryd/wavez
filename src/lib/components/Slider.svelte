<script lang="ts">
	let {
		value,
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		accentClass = 'bg-sky-300',
		heightClass = 'h-44',
		widthClass = 'w-5',
		ariaLabel,
		oninput,
		onchange
	}: {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		accentClass?: string;
		heightClass?: string;
		widthClass?: string;
		ariaLabel?: string;
		oninput?: (value: number) => void;
		onchange?: (value: number) => void;
	} = $props();

	let track = $state<HTMLDivElement | null>(null);
	let isDragging = $state(false);

	function clamp(next: number) {
		return Math.max(min, Math.min(max, next));
	}

	function quantize(next: number) {
		if (!Number.isFinite(step) || step <= 0) return next;
		const snapped = Math.round((next - min) / step) * step + min;
		const decimals = `${step}`.split('.')[1]?.length ?? 0;
		return Number(snapped.toFixed(decimals));
	}

	function normalized() {
		if (max === min) return 0;
		return (value - min) / (max - min);
	}

	function setValue(next: number, emitChange: boolean) {
		const clamped = clamp(quantize(next));
		if (clamped === value) return;
		value = clamped;
		oninput?.(value);
		if (emitChange) onchange?.(value);
	}

	function setFromClientY(clientY: number, emitChange: boolean) {
		if (!track) return;
		const rect = track.getBoundingClientRect();
		const raw = 1 - (clientY - rect.top) / rect.height;
		const t = Math.max(0, Math.min(1, raw));
		setValue(min + t * (max - min), emitChange);
	}

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		if (disabled) return;
		isDragging = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		setFromClientY(e.clientY, false);
	}

	function onPointerMove(e: PointerEvent) {
		e.preventDefault();
		if (disabled || !isDragging) return;
		setFromClientY(e.clientY, false);
	}

	function onPointerUp(e: PointerEvent) {
		e.preventDefault();
		if (disabled || !isDragging) return;
		isDragging = false;
		setFromClientY(e.clientY, true);
	}

	function onPointerCancel() {
		isDragging = false;
	}

	function onKeyDown(e: KeyboardEvent) {
		if (disabled) return;
		const delta = Number.isFinite(step) && step > 0 ? step : (max - min) / 100;
		switch (e.key) {
			case 'ArrowUp':
			case 'ArrowRight':
				e.preventDefault();
				setValue(value + delta, true);
				break;
			case 'ArrowDown':
			case 'ArrowLeft':
				e.preventDefault();
				setValue(value - delta, true);
				break;
			case 'PageUp':
				e.preventDefault();
				setValue(value + delta * 5, true);
				break;
			case 'PageDown':
				e.preventDefault();
				setValue(value - delta * 5, true);
				break;
			case 'Home':
				e.preventDefault();
				setValue(min, true);
				break;
			case 'End':
				e.preventDefault();
				setValue(max, true);
				break;
		}
	}
</script>

<div
	class={`relative ${heightClass} ${widthClass} touch-none pt-5 select-none`}
	aria-disabled={disabled}
>
	<div
		bind:this={track}
		class="relative h-full w-full rounded-full bg-white/10 focus:ring-2 focus:ring-sky-400/35 focus:outline-none"
		role="slider"
		tabindex={disabled ? undefined : 0}
		aria-label={ariaLabel}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerCancel}
		onlostpointercapture={onPointerCancel}
		onkeydown={onKeyDown}
	>
		<div
			class={`absolute right-0 bottom-0 left-0 rounded-b-full ${accentClass}`}
			style={`height: ${normalized() * 100}%`}
		></div>
		<div
			class={`absolute left-1/2 size-6 -translate-x-1/2 rounded-full ${accentClass} shadow-[0_6px_18px_rgba(0,0,0,0.35)]`}
			style={`bottom: calc(${normalized() * 100}% - 0.5rem)`}
		></div>
	</div>
</div>
