<script lang="ts">
	import { onMount } from 'svelte';

	let {
		analyser,
		onlevelchange,
		fullscreen = false
	}: {
		analyser: AnalyserNode | null;
		onlevelchange?: (level: number) => void;
		fullscreen?: boolean;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let animationFrameId = $state<number | null>(null);
	let timeDomain = $state<Uint8Array | null>(null);
	let frequency = $state<Uint8Array | null>(null);

	function render() {
		animationFrameId = requestAnimationFrame(render);
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.floor(rect.width * dpr));
		const height = Math.max(1, Math.floor(rect.height * dpr));
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}

		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = 'rgba(2, 6, 23, 0.2)';
		ctx.fillRect(0, 0, width, height);

		if (!analyser) return;

		if (!timeDomain || timeDomain.length !== analyser.fftSize)
			timeDomain = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>;
		const bins = analyser.frequencyBinCount;
		if (!frequency || frequency.length !== bins)
			frequency = new Uint8Array(bins) as Uint8Array<ArrayBuffer>;

		analyser.getByteTimeDomainData(timeDomain);
		analyser.getByteFrequencyData(frequency);

		let sumSquares = 0;
		for (let i = 0; i < timeDomain.length; i += 1) {
			const v = (timeDomain[i] - 128) / 128;
			sumSquares += v * v;
		}
		const level = Math.sqrt(sumSquares / timeDomain.length);
		onlevelchange?.(level);

		const xStep = width / (timeDomain.length - 1);
		ctx.lineWidth = Math.max(1, 1.6 * dpr);
		const waveGradient = ctx.createLinearGradient(0, 0, width, 0);
		waveGradient.addColorStop(0, 'rgba(244, 114, 182, 0.95)');
		waveGradient.addColorStop(0.45, 'rgba(96, 165, 250, 0.95)');
		waveGradient.addColorStop(1, 'rgba(167, 139, 250, 0.95)');
		ctx.strokeStyle = waveGradient;
		ctx.beginPath();
		for (let i = 0; i < timeDomain.length; i += 1) {
			const v = (timeDomain[i] - 128) / 128;
			const x = i * xStep;
			const y = height * 0.35 + v * height * 0.22;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();

		const barCount = Math.min(96, frequency.length);
		const barWidth = width / barCount;
		for (let i = 0; i < barCount; i += 1) {
			const value = frequency[Math.floor((i / barCount) * frequency.length)] ?? 0;
			const t = value / 255;
			const barHeight = t * height * 0.35;
			const x = i * barWidth;
			const y = height - barHeight;
			ctx.fillStyle = `rgba(148, 163, 184, ${0.06 + 0.2 * t})`;
			ctx.fillRect(x + barWidth * 0.14, y, barWidth * 0.72, barHeight);
		}
	}

	onMount(() => {
		render();
		return () => {
			if (animationFrameId) cancelAnimationFrame(animationFrameId);
		};
	});
</script>

{#if fullscreen}
	<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
		<canvas bind:this={canvas} class="h-full w-full opacity-40"></canvas>
	</div>
{:else}
	<div
		class="mt-5 overflow-hidden rounded-3xl bg-slate-950/40 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
	>
		<div class="relative h-[320px] w-full sm:h-[380px]">
			<canvas bind:this={canvas} class="absolute inset-0 h-full w-full"></canvas>
			<div
				class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_55%)]"
			></div>
			<div
				class="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/70 to-transparent"
			></div>
		</div>
	</div>
{/if}
