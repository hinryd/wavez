<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{@render children()}
