<script lang="ts">
	import './layout.css';
	import WavezIcon from '$lib/assets/wavez.png';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap"
		rel="stylesheet"
	/>
	<link rel="icon" href={WavezIcon} />
</svelte:head>
{@render children()}
