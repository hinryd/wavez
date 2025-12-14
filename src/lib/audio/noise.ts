import { browser } from '$app/environment';
import type { NoiseColor } from './noise-worklet';

export const octaveBandCentersHz = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

type PinkState = {
	b0: number;
	b1: number;
	b2: number;
	b3: number;
	b4: number;
	b5: number;
	b6: number;
};

type ChannelState = {
	rng: number;
	lastWhite: number;
	brown: number;
	pink: PinkState;
	blue: number;
};

function createChannelState(seed: number): ChannelState {
	return {
		rng: seed >>> 0,
		lastWhite: 0,
		brown: 0,
		pink: { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 },
		blue: 0
	};
}

function nextUniform(state: ChannelState) {
	state.rng = (1664525 * state.rng + 1013904223) >>> 0;
	return state.rng / 4294967296;
}

function nextWhite(state: ChannelState) {
	return nextUniform(state) * 2 - 1;
}

function nextPink(state: ChannelState) {
	const white = nextWhite(state);
	const p = state.pink;

	p.b0 = 0.99886 * p.b0 + white * 0.0555179;
	p.b1 = 0.99332 * p.b1 + white * 0.0750759;
	p.b2 = 0.969 * p.b2 + white * 0.153852;
	p.b3 = 0.8665 * p.b3 + white * 0.3104856;
	p.b4 = 0.55 * p.b4 + white * 0.5329522;
	p.b5 = -0.7616 * p.b5 - white * 0.016898;
	const out = p.b0 + p.b1 + p.b2 + p.b3 + p.b4 + p.b5 + p.b6 + white * 0.5362;
	p.b6 = white * 0.115926;

	return out * 0.11;
}

function nextBrown(state: ChannelState) {
	const white = nextWhite(state);
	state.brown = (state.brown + 0.02 * white) / 1.02;
	return state.brown * 3.5;
}

function nextViolet(state: ChannelState) {
	const white = nextWhite(state);
	const out = white - state.lastWhite;
	state.lastWhite = white;
	return out * 0.9;
}

function nextBlue(state: ChannelState) {
	const white = nextWhite(state);
	const alpha = 0.995;
	state.blue = alpha * (state.blue + white - state.lastWhite);
	state.lastWhite = white;
	return state.blue * 0.6;
}

function nextSample(color: NoiseColor, state: ChannelState) {
	switch (color) {
		case 'pink':
			return nextPink(state);
		case 'brown':
			return nextBrown(state);
		case 'blue':
			return nextBlue(state);
		case 'violet':
			return nextViolet(state);
		default:
			return nextWhite(state) * 0.6;
	}
}

function clamp1(value: number) {
	return Math.max(-1, Math.min(1, value));
}

type BiquadCoefficients = {
	b0: number;
	b1: number;
	b2: number;
	a1: number;
	a2: number;
};

type BiquadState = {
	x1: number;
	x2: number;
	y1: number;
	y2: number;
};

function createPeakingCoefficients(args: {
	sampleRate: number;
	frequencyHz: number;
	q: number;
	gainDb: number;
}): BiquadCoefficients {
	const { sampleRate, frequencyHz, q, gainDb } = args;
	const a = Math.pow(10, gainDb / 40);
	const w0 = (2 * Math.PI * frequencyHz) / sampleRate;
	const cosW0 = Math.cos(w0);
	const sinW0 = Math.sin(w0);
	const alpha = sinW0 / (2 * q);

	const b0 = 1 + alpha * a;
	const b1 = -2 * cosW0;
	const b2 = 1 - alpha * a;
	const a0 = 1 + alpha / a;
	const a1 = -2 * cosW0;
	const a2 = 1 - alpha / a;

	return {
		b0: b0 / a0,
		b1: b1 / a0,
		b2: b2 / a0,
		a1: a1 / a0,
		a2: a2 / a0
	};
}

function processBiquadInPlace(samples: Float32Array, coefficients: BiquadCoefficients, state: BiquadState) {
	const { b0, b1, b2, a1, a2 } = coefficients;
	let { x1, x2, y1, y2 } = state;

	for (let i = 0; i < samples.length; i += 1) {
		const x0 = samples[i] ?? 0;
		const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
		x2 = x1;
		x1 = x0;
		y2 = y1;
		y1 = y0;
		samples[i] = y0;
	}

	state.x1 = x1;
	state.x2 = x2;
	state.y1 = y1;
	state.y2 = y2;
}

function writeAscii(view: DataView, offset: number, value: string) {
	for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}

function encodeWavPcm16(samples: Float32Array[], sampleRate: number) {
	const channelCount = samples.length;
	const frameCount = samples[0]?.length ?? 0;
	const bytesPerSample = 2;
	const blockAlign = channelCount * bytesPerSample;
	const byteRate = sampleRate * blockAlign;
	const dataSize = frameCount * blockAlign;

	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	writeAscii(view, 0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	writeAscii(view, 8, 'WAVE');
	writeAscii(view, 12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channelCount, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true);
	writeAscii(view, 36, 'data');
	view.setUint32(40, dataSize, true);

	let writeOffset = 44;
	for (let frame = 0; frame < frameCount; frame += 1) {
		for (let ch = 0; ch < channelCount; ch += 1) {
			const s = clamp1(samples[ch][frame] ?? 0);
			view.setInt16(writeOffset, Math.round(s * 0x7fff), true);
			writeOffset += 2;
		}
	}

	return new Blob([buffer], { type: 'audio/wav' });
}

export type NoiseEngine = {
	start: () => Promise<void>;
	stop: () => Promise<void>;
	destroy: () => Promise<void>;
	getBandsHz: () => readonly number[];
	setBandsDb: (bandsDb: readonly number[]) => void;
	setGain: (gain: number) => void;
	getAnalyser: () => AnalyserNode | null;
	exportWav: (args: { durationSeconds: number; sampleRate?: number }) => Blob;
};

export function createNoiseEngine(): NoiseEngine {
	const q = Math.SQRT2;
	let color: NoiseColor = 'white';
	let gain = 0.2;
	let bandsDb = octaveBandCentersHz.map(() => 0);

	let audioContext: AudioContext | null = null;
	let workletNode: AudioWorkletNode | null = null;
	let scriptNode: ScriptProcessorNode | null = null;
	let shaperInput: GainNode | null = null;
	let eqFilters: BiquadFilterNode[] = [];
	let outputGain: GainNode | null = null;
	let analyser: AnalyserNode | null = null;
	let started = false;

	const leftState = createChannelState(((Math.random() * 0xffffffff) >>> 0) ^ 0xa1b2c3d4);
	const rightState = createChannelState(((Math.random() * 0xffffffff) >>> 0) ^ 0x5a5aa5a5);

	async function ensureContext() {
		if (!browser) throw new Error('Audio is only available in the browser.');
		if (audioContext) return audioContext;

		const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		audioContext = new AudioContextCtor();
		shaperInput = audioContext.createGain();
		shaperInput.gain.value = 1;

		eqFilters = octaveBandCentersHz.map((frequencyHz, bandIndex) => {
			const filter = audioContext!.createBiquadFilter();
			filter.type = 'peaking';
			filter.frequency.value = frequencyHz;
			filter.Q.value = q;
			filter.gain.value = bandsDb[bandIndex] ?? 0;
			return filter;
		});

		outputGain = audioContext.createGain();
		outputGain.gain.value = 0;
		analyser = audioContext.createAnalyser();
		analyser.fftSize = 2048;
		analyser.smoothingTimeConstant = 0.85;

		let node: AudioNode = shaperInput;
		for (const filter of eqFilters) {
			node.connect(filter);
			node = filter;
		}
		node.connect(outputGain);
		outputGain.connect(analyser);
		analyser.connect(audioContext.destination);

		return audioContext;
	}

	async function ensureSource(ctx: AudioContext) {
		if (workletNode || scriptNode) return;

		if (ctx.audioWorklet) {
			try {
				const moduleUrl = new URL('./noise-worklet.ts', import.meta.url);
				await ctx.audioWorklet.addModule(moduleUrl.toString());
				workletNode = new AudioWorkletNode(ctx, 'colored-noise', { numberOfOutputs: 1, outputChannelCount: [2] });
				workletNode.connect(shaperInput!);
				return;
			} catch {
				workletNode = null;
			}
		}

		const createScriptProcessor = (ctx as unknown as AudioContext & {
			createScriptProcessor?: (bufferSize: number, numberOfInputChannels: number, numberOfOutputChannels: number) => ScriptProcessorNode;
		}).createScriptProcessor;

		if (!createScriptProcessor) throw new Error('ScriptProcessorNode is not available in this browser.');

		const node = createScriptProcessor.call(ctx, 1024, 0, 2);
		scriptNode = node;
		node.onaudioprocess = (event) => {
			const out0 = event.outputBuffer.getChannelData(0);
			const out1 = event.outputBuffer.getChannelData(1);

			for (let i = 0; i < out0.length; i += 1) {
				out0[i] = nextSample(color, leftState);
				out1[i] = nextSample(color, rightState);
			}
		};
		node.connect(shaperInput!);
	}

	function rampGain(target: number) {
		if (!audioContext || !outputGain) return;
		const now = audioContext.currentTime;
		outputGain.gain.cancelScheduledValues(now);
		outputGain.gain.setTargetAtTime(target, now, 0.03);
	}

	return {
		async start() {
			const ctx = await ensureContext();
			await ensureSource(ctx);
			await ctx.resume();
			rampGain(gain);
			started = true;
		},
		async stop() {
			if (!audioContext) return;
			rampGain(0);
			await new Promise((r) => setTimeout(r, 80));
			await audioContext.suspend();
			started = false;
		},
		async destroy() {
			if (!audioContext) return;
			rampGain(0);
			workletNode?.disconnect();
			scriptNode?.disconnect();
			shaperInput?.disconnect();
			for (const filter of eqFilters) filter.disconnect();
			outputGain?.disconnect();
			analyser?.disconnect();
			workletNode = null;
			scriptNode = null;
			shaperInput = null;
			eqFilters = [];
			outputGain = null;
			analyser = null;
			await audioContext.close();
			audioContext = null;
			started = false;
		},
		getBandsHz() {
			return octaveBandCentersHz;
		},
		setBandsDb(next) {
			if (next.length !== octaveBandCentersHz.length) return;
			bandsDb = next.map((v) => clamp(v, -24, 24));
			if (!audioContext) return;
			const now = audioContext.currentTime;
			for (let i = 0; i < eqFilters.length; i += 1) {
				const filter = eqFilters[i];
				const value = bandsDb[i] ?? 0;
				filter.gain.cancelScheduledValues(now);
				filter.gain.setTargetAtTime(value, now, 0.04);
			}
		},
		setGain(next) {
			gain = Math.max(0, Math.min(1, next));
			if (started) rampGain(gain);
		},
		getAnalyser() {
			return analyser;
		},
		exportWav({ durationSeconds, sampleRate }) {
			const sr = sampleRate ?? 44100;
			const frames = Math.max(1, Math.floor(durationSeconds * sr));

			const l = new Float32Array(frames);
			const r = new Float32Array(frames);
			const s0 = createChannelState(0x12345678);
			const s1 = createChannelState(0x87654321);

			for (let i = 0; i < frames; i += 1) {
				l[i] = nextSample(color, s0);
				r[i] = nextSample(color, s1);
			}

			for (let bandIndex = 0; bandIndex < octaveBandCentersHz.length; bandIndex += 1) {
				const gainDb = bandsDb[bandIndex] ?? 0;
				if (gainDb === 0) continue;

				const frequencyHz = octaveBandCentersHz[bandIndex] ?? 1000;
				const coefficients = createPeakingCoefficients({ sampleRate: sr, frequencyHz, q, gainDb });
				processBiquadInPlace(l, coefficients, { x1: 0, x2: 0, y1: 0, y2: 0 });
				processBiquadInPlace(r, coefficients, { x1: 0, x2: 0, y1: 0, y2: 0 });
			}

			for (let i = 0; i < frames; i += 1) {
				l[i] *= gain;
				r[i] *= gain;
			}

			return encodeWavPcm16([l, r], sr);
		}
	};
}
