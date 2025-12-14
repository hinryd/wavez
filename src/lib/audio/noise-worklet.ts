export type NoiseColor = 'white' | 'pink' | 'brown' | 'blue' | 'violet';

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

class ColoredNoiseProcessor extends AudioWorkletProcessor {
	static get parameterDescriptors() {
		return [
			{
				name: 'amplitude',
				defaultValue: 1,
				minValue: 0,
				maxValue: 2,
				automationRate: 'k-rate'
			}
		];
	}

	color: NoiseColor = 'white';
	states: ChannelState[];

	constructor() {
		super();

		this.states = Array.from({ length: 2 }, (_, i) => ({
			rng: (Math.random() * 0xffffffff) >>> 0 ^ (i * 0x9e3779b9),
			lastWhite: 0,
			brown: 0,
			pink: { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 },
			blue: 0
		}));

		this.port.onmessage = (event: MessageEvent) => {
			const data = event.data as { type?: string; color?: NoiseColor };
			if (data?.type === 'set-color' && data.color) this.color = data.color;
		};
	}

	process(
		_inputs: Float32Array[][],
		outputs: Float32Array[][],
		parameters: Record<string, Float32Array>
	) {
		const output = outputs[0];
		if (!output) return true;

		const amplitude = parameters.amplitude;
		const amp = amplitude?.length ? amplitude[0] : 1;
		const channelCount = output.length;
		const frames = output[0]?.length ?? 0;

		for (let i = 0; i < frames; i += 1) {
			for (let ch = 0; ch < channelCount; ch += 1) {
				const state = this.states[ch] ?? this.states[0];
				const sample = nextSample(this.color, state) * amp;
				output[ch][i] = sample;
			}
		}

		return true;
	}
}

registerProcessor('colored-noise', ColoredNoiseProcessor);
