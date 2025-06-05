import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasmPack from 'vite-plugin-wasm-pack';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from "vite-plugin-top-level-await";
import { SvelteKitPWA } from '@vite-pwa/sveltekit'
export default defineConfig({
	plugins: [tailwindcss(),
	sveltekit(),
	SvelteKitPWA({
		workbox: {
			globPatterns: ["**/*"],
		},
		includeAssets: [
			"**/*",
		],
	}),
	wasm(),
	wasmPack(['./wasm-lib']),
	topLevelAwait()],
	server: {
		host: '127.0.0.1',
		port: 5173
	},
	preview: {
		host: '127.0.0.1',
		port: 5173
	}
});
