import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasmPack from 'vite-plugin-wasm-pack';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from "vite-plugin-top-level-await";
import { SvelteKitPWA } from '@vite-pwa/sveltekit'

const dev = process.env.NODE_ENV === 'development';
export default defineConfig({
	plugins: [tailwindcss(),
	sveltekit(),
	SvelteKitPWA({
		srcDir: './src',
		registerType: 'autoUpdate',
		strategies: dev ? 'generateSW' : 'injectManifest',
		manifest: {
			short_name: 'Share count',
			name: 'Share count',
			display: 'standalone',
		},
		injectManifest: {
			globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
		},
		workbox: {
			globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
		},
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
