// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	class AudioWorkletProcessor {
		readonly port: MessagePort;
		constructor();
		process(
			inputs: Float32Array[][],
			outputs: Float32Array[][],
			parameters: Record<string, Float32Array>
		): boolean;
	}

	function registerProcessor(
		name: string,
		processorCtor: (new (...args: unknown[]) => AudioWorkletProcessor) & {
			parameterDescriptors?: AudioParamDescriptor[];
		}
	): void;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
