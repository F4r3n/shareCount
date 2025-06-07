import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasmPack from 'vite-plugin-wasm-pack';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from "vite-plugin-top-level-await";
import { SvelteKitPWA } from '@vite-pwa/sveltekit'
import { generateSW } from './generateSW.mjs';

export default defineConfig({
	plugins: [tailwindcss(),
	sveltekit(),
	SvelteKitPWA({
		srcDir: './src',
		registerType: 'autoUpdate',
		strategies: generateSW ? "generateSW" : "injectManifest",
		filename: "sw.ts",
		devOptions: {
			enabled: true,
			type: 'module',
			navigateFallback: '/',
			suppressWarnings:true
		},
		manifest: {
			short_name: 'Share count',
			name: 'Share count',
			display: 'standalone',
		},
		workbox: {
			navigateFallback: "/shareCount",
			globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2,wasm,html}'],
		},
		injectManifest: {
			globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2,wasm,html}'],
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
	},
	define: {
		'process.env.NODE_ENV': process.env.NODE_ENV === 'production' ? '"production"' : '"development"',
	},
	resolve: process.env.VITEST
		? {
			conditions: ['browser']
		}
		: undefined
});
