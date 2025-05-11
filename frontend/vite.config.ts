import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit'

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), SvelteKitPWA()],
	server: {
		host: '127.0.0.1',
		port: 5173
	  }
});
