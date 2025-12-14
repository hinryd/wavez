<script lang="ts">
	import { onMount } from 'svelte';
	import { createNoiseEngine, octaveBandCentersHz, type NoiseEngine } from '$lib/audio/noise';
	import Slider from '$lib/components/Slider.svelte';
	import Visualizer from '$lib/components/Visualizer.svelte';

	type PresetId =
		| 'brown'
		| 'pink'
		| 'white'
		| 'green'
		| 'grey'
		| 'infra'
		| 'ultra'
		| '60hz'
		| '125hz'
		| '250hz'
		| '500hz'
		| '1khz'
		| '2khz'
		| '4khz'
		| '8khz'
		| 'speech-blocker'
		| 'ear-massage'
		| 'random'
		| 'custom';

	function formatFrequencyLabel(frequencyHz: number) {
		if (frequencyHz >= 1000) return `${Math.round(frequencyHz / 1000)}k`;
		return `${Math.round(frequencyHz)}`;
	}

	function createTiltBandsDb(args: { pivotIndex: number; slopeDbPerOctave: number }) {
		const { pivotIndex, slopeDbPerOctave } = args;
		return octaveBandCentersHz.map((_, index) => (pivotIndex - index) * slopeDbPerOctave);
	}

	const presets: {
		id: Exclude<PresetId, 'custom'>;
		label: string;
		hint: string;
		bandsDb: number[] | (() => number[]);
		color?: string;
	}[] = [
		{
			id: 'brown',
			label: 'Brown',
			hint: 'Heavy low end, deep masking',
			bandsDb: createTiltBandsDb({ pivotIndex: 5, slopeDbPerOctave: 6 }),
			color: 'bg-amber-700'
		},
		{
			id: 'pink',
			label: 'Pink',
			hint: 'Balanced for focus',
			bandsDb: createTiltBandsDb({ pivotIndex: 5, slopeDbPerOctave: 3 }),
			color: 'bg-pink-400'
		},
		{
			id: 'white',
			label: 'White',
			hint: 'Flat spectrum',
			bandsDb: octaveBandCentersHz.map(() => 0),
			color: 'bg-white'
		},
		{
			id: 'green',
			label: 'Green',
			hint: 'Speech masking (mid emphasis)',
			bandsDb: [-12, -8, -4, 0, 4, 6, 6, 4, 0, -6],
			color: 'bg-green-400'
		},
		{
			id: 'grey',
			label: 'Grey',
			hint: 'Psychoacoustically balanced',
			bandsDb: [-6, -4, -2, 0, 2, 3, 2, 0, -2, -4],
			color: 'bg-slate-400'
		},
		{
			id: 'infra',
			label: 'Infra',
			hint: 'Sub-bass rumble',
			bandsDb: [12, 6, 0, -6, -12, -18, -24, -24, -24, -24]
		},
		{
			id: 'ultra',
			label: 'Ultra',
			hint: 'High frequency shimmer',
			bandsDb: [-24, -24, -24, -18, -12, -6, 0, 6, 12, 12]
		},
		{
			id: '60hz',
			label: '60 Hz',
			hint: 'Around 60 Hz focus',
			bandsDb: [6, 12, 6, -6, -12, -18, -24, -24, -24, -24]
		},
		{
			id: '125hz',
			label: '125 Hz',
			hint: 'Low frequency focus',
			bandsDb: [-6, 6, 12, 6, -6, -12, -18, -24, -24, -24]
		},
		{
			id: '250hz',
			label: '250 Hz',
			hint: 'Low-mid focus',
			bandsDb: [-12, -6, 6, 12, 6, -6, -12, -18, -24, -24]
		},
		{
			id: '500hz',
			label: '500 Hz',
			hint: 'Mid-bass focus',
			bandsDb: [-18, -12, -6, 6, 12, 6, -6, -12, -18, -24]
		},
		{
			id: '1khz',
			label: '1 kHz',
			hint: 'Mid frequency focus',
			bandsDb: [-24, -18, -12, -6, 6, 12, 6, -6, -12, -18]
		},
		{
			id: '2khz',
			label: '2 kHz',
			hint: 'Upper-mid focus',
			bandsDb: [-24, -24, -18, -12, -6, 6, 12, 6, -6, -12]
		},
		{
			id: '4khz',
			label: '4 kHz',
			hint: 'Presence frequency focus',
			bandsDb: [-24, -24, -24, -18, -12, -6, 6, 12, 6, -6]
		},
		{
			id: '8khz',
			label: '8 kHz',
			hint: 'High frequency focus',
			bandsDb: [-24, -24, -24, -24, -18, -12, -6, 6, 12, 6]
		},
		{
			id: 'speech-blocker',
			label: 'Speech Blocker',
			hint: 'Optimized for blocking speech',
			bandsDb: [-12, -6, 0, 6, 10, 12, 10, 6, 0, -6]
		},
		{
			id: 'ear-massage',
			label: 'Ear Massage',
			hint: 'Gentle, soothing frequencies',
			bandsDb: [6, 4, 2, 0, -2, -4, -2, 0, 2, 4]
		},
		{
			id: 'random',
			label: 'Random',
			hint: 'Randomized EQ curve',
			bandsDb: () => octaveBandCentersHz.map(() => Math.round(Math.random() * 48 - 24))
		}
	];

	const sliderAccents = [
		'bg-amber-300',
		'bg-orange-300',
		'bg-rose-300',
		'bg-fuchsia-300',
		'bg-violet-300',
		'bg-indigo-300',
		'bg-sky-300',
		'bg-cyan-300',
		'bg-emerald-300',
		'bg-lime-300'
	];

	let engine = $state<NoiseEngine | null>(null);
	let isPlaying = $state(false);
	let preset = $state<PresetId>('pink');
	let bandsDb = $state<number[]>(
		presets.find((p) => p.id === 'pink')?.bandsDb.slice() ?? octaveBandCentersHz.map(() => 0)
	);
	let volume = $state(0.22);
	let exportSeconds = $state(12);
	let outputLevel = $state(0);

	let analyserNode = $state<AnalyserNode | null>(null);

	function getPresetLabel(id: PresetId) {
		if (id === 'custom') return 'Custom';
		return presets.find((p) => p.id === id)?.label ?? id;
	}

	function clampDb(value: number) {
		return Math.max(-24, Math.min(24, value));
	}

	function applyPreset(next: Exclude<PresetId, 'custom'>) {
		preset = next;
		const found = presets.find((p) => p.id === next);
		const target =
			typeof found?.bandsDb === 'function'
				? found.bandsDb()
				: (found?.bandsDb ?? octaveBandCentersHz.map(() => 0));
		bandsDb = target.map((v) => clampDb(v));
	}

	function setBandDb(index: number, value: number) {
		preset = 'custom';
		bandsDb = bandsDb.map((v, i) => (i === index ? clampDb(value) : v));
	}

	async function setPlaying(next: boolean) {
		if (!engine) return;
		if (next === isPlaying) return;
		if (next) {
			await engine.start();
			updateAnalyser();
		} else {
			await engine.stop();
		}
		isPlaying = next;
	}

	function downloadWav() {
		if (!engine) return;
		const blob = engine.exportWav({ durationSeconds: exportSeconds });
		const fileName = `wavez-${preset}-${exportSeconds}s.wav`;
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1500);
	}

	function updateAnalyser() {
		analyserNode = engine?.getAnalyser() ?? null;
	}

	onMount(() => {
		engine = createNoiseEngine();
		engine.setGain(volume);
		engine.setBandsDb(bandsDb);
		updateAnalyser();

		return () => {
			engine?.destroy();
		};
	});

	$effect(() => {
		engine?.setGain(volume);
	});

	$effect(() => {
		engine?.setBandsDb(bandsDb);
	});
</script>

<svelte:head>
	<title>Wavez — Colored Noise Generator</title>
	<meta
		name="description"
		content="A sleek colored noise generator with a 10-band octave EQ, classic presets (Brown/Pink/White/Green), live visualization, and WAV export."
	/>
</svelte:head>

<div class="relative min-h-dvh overflow-hidden bg-slate-950 text-slate-100">
	<Visualizer analyser={analyserNode} onlevelchange={(level) => (outputLevel = level)} fullscreen />

	<div class="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-7 sm:px-8 sm:py-10">
		<header class="flex flex-col gap-2">
			<div class="flex items-center justify-center gap-3">
				<div class="flex flex-col items-center">
					<h1 class="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Wavez</h1>
					<p class="px-3 text-sm text-slate-300">
						Colored noise generator for focus, masking, and sound design
					</p>
				</div>
			</div>
		</header>

		<main class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<section class="lg:col-span-7">
				<div
					class="rounded-3xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.09)] backdrop-blur-xl sm:p-6"
				>
					<div class="flex items-start justify-between gap-4">
						<div class="flex flex-col gap-1">
							<h2 class="text-lg font-semibold">Player</h2>
							<p class="text-sm text-slate-300">
								10-band octave EQ. Choose a preset, then shape it.
							</p>
						</div>
						<button
							type="button"
							onclick={() => setPlaying(!isPlaying)}
							class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500/20 via-sky-500/20 to-violet-500/20 px-4 py-2 text-sm font-medium shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition hover:from-fuchsia-500/30 hover:via-sky-500/30 hover:to-violet-500/30 focus:ring-2 focus:ring-sky-400/40 focus:outline-none"
						>
							{#if isPlaying}
								<svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
									<path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
								</svg>
								Pause
							{:else}
								<svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
									<path d="M8 5v14l11-7-11-7Z" />
								</svg>
								Play
							{/if}
						</button>
					</div>

					<div class="mt-5 rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
						<div class="flex items-end justify-between gap-2 overflow-x-auto">
							{#each octaveBandCentersHz as frequencyHz, bandIndex (frequencyHz)}
								<div class="flex w-10 shrink-0 flex-col items-center gap-2">
									<Slider
										value={bandsDb[bandIndex] ?? 0}
										min={-24}
										max={24}
										step={1}
										accentClass={sliderAccents[bandIndex] ?? 'bg-sky-300'}
										ariaLabel={`${frequencyHz} Hz band`}
										oninput={(v) => setBandDb(bandIndex, v)}
									/>
									<div class="flex flex-col items-center">
										<span class="text-xs font-medium text-slate-200 tabular-nums"
											>{formatFrequencyLabel(frequencyHz)}</span
										>
										<span class="text-[10px] text-slate-400">Hz</span>
									</div>
									<div class="flex flex-col items-center">
										<span class="text-[10px] text-slate-400 tabular-nums"
											>{bandsDb[bandIndex] ?? 0} dB</span
										>
									</div>
								</div>
							{/each}
						</div>
						<div class="mt-4 flex flex-wrap items-center gap-2">
							{#each presets as p (p.id)}
								<button
									type="button"
									onclick={() => applyPreset(p.id)}
									class={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition focus:ring-2 focus:ring-sky-400/35 focus:outline-none ${
										preset === p.id ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'
									}`}
								>
									{#if p.color}<span class={`size-2.5 rounded-full ${p.color}`}></span>{/if}
									{p.label}
								</button>
							{/each}
							<div
								class={`rounded-2xl px-3 py-2 text-sm font-medium shadow-[0_0_0_1px_rgba(255,255,255,0.12)] ${
									preset === 'custom' ? 'bg-white/15 text-slate-100' : 'bg-white/5 text-slate-400'
								}`}
							>
								Custom
							</div>
						</div>
						<div class="mt-2 text-xs text-slate-300">
							{#if preset === 'custom'}
								Edited EQ curve
							{:else}
								{presets.find((p) => p.id === preset)?.hint}
							{/if}
						</div>
					</div>

					<div class="mt-6 flex flex-col gap-4">
						<div class="flex items-center justify-between">
							<div class="flex flex-col">
								<span class="text-sm font-medium">Volume</span>
								<span class="text-xs text-slate-300">Smooth ramp, click Play to hear changes.</span>
							</div>
							<span class="text-sm text-slate-200 tabular-nums">{(volume * 100).toFixed(0)}%</span>
						</div>
						<input
							type="range"
							min="0"
							max="100"
							value={(volume * 100).toFixed(0)}
							oninput={(e) => (volume = Number((e.currentTarget as HTMLInputElement).value) / 100)}
							class="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-sky-300"
						/>
					</div>
				</div>
			</section>

			<section class="lg:col-span-5">
				<div
					class="rounded-3xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.09)] backdrop-blur-xl sm:p-6"
				>
					<div class="flex flex-col gap-3">
						<div class="flex flex-wrap items-center gap-3 text-sm text-slate-300">
							<div
								class="rounded-full bg-white/5 px-3 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
							>
								{getPresetLabel(preset)} preset
							</div>
							<div
								class="rounded-full bg-white/5 px-3 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
							>
								Volume {(volume * 100).toFixed(0)}%
							</div>
							<div
								class="rounded-full bg-white/5 px-3 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
							>
								Level {(outputLevel * 100).toFixed(0)}%
							</div>
						</div>
						<div class="rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
							<span class="text-sm font-medium">Now playing</span>
							<div class="mt-2 flex items-center justify-between">
								<span class="text-sm text-slate-300">{isPlaying ? 'On' : 'Off'}</span>
								<span class="text-sm text-slate-200">{getPresetLabel(preset)}</span>
							</div>
						</div>
						<div class="rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
							<span class="text-sm font-medium">Safety</span>
							<p class="mt-2 text-sm text-slate-300">
								Keep it comfortable. Your ears don't need max volume.
							</p>
						</div>

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div class="rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium">Export WAV</span>
									<span class="text-sm text-slate-200 tabular-nums">{exportSeconds}s</span>
								</div>
								<input
									type="range"
									min="1"
									max="60"
									step="1"
									value={exportSeconds}
									oninput={(e) =>
										(exportSeconds = Number((e.currentTarget as HTMLInputElement).value))}
									class="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-fuchsia-300"
								/>
								<button
									type="button"
									onclick={downloadWav}
									class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-medium shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition hover:bg-white/15 focus:ring-2 focus:ring-fuchsia-400/35 focus:outline-none"
								>
									<svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
										<path
											d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4.01 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.41-1.42L11 13.59V4a1 1 0 0 1 1-1Z"
										/>
										<path d="M5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z" />
									</svg>
									Download
								</button>
							</div>
							<div class="rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
								<span class="text-sm font-medium">Quick tips</span>
								<div class="mt-3 flex flex-col gap-2 text-sm text-slate-300">
									<div class="flex items-start gap-2">
										<span class="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-sky-300"></span>
										<span>Pink for focus, brown for masking low rumbles.</span>
									</div>
									<div class="flex items-start gap-2">
										<span class="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-fuchsia-300"></span>
										<span>Start quiet, then increase until distractions fade.</span>
									</div>
									<div class="flex items-start gap-2">
										<span class="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-violet-300"></span>
										<span>Export a WAV loop for offline listening.</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</main>

		<footer class="flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-slate-400">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<span>Audio runs locally in your browser.</span>
				<a
					class="text-slate-300 underline decoration-white/20 underline-offset-4 hover:text-white"
					href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API"
					target="_blank"
					rel="noreferrer">Web Audio API</a
				>
			</div>
		</footer>
	</div>
</div>
