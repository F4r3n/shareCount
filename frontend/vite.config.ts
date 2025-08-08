import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from "vite-plugin-top-level-await";
import { SvelteKitPWA } from '@vite-pwa/sveltekit'
import { generateSW } from './generateSW.mjs';

const host = process.env.TAURI_DEV_HOST;
const IS_MOBILE = process.env.TAURI_DEV_HOST != undefined;
const plugins = [tailwindcss(),
sveltekit(),
wasm(),
topLevelAwait()];

if (!IS_MOBILE) {
	plugins.push(SvelteKitPWA({
		srcDir: './src',
		registerType: 'autoUpdate',
		strategies: generateSW ? "generateSW" : "injectManifest",
		filename: "sw.ts",
		devOptions: {
			enabled: true,
			type: 'module',
			navigateFallback: '/',
			suppressWarnings: true
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
	}))
}

export default defineConfig({
	plugins: plugins,
	server: {
		port: 5173,
		strictPort: true,
		fs: {
			allow: ['./wasm-lib/pkg'],
		},
		host: host || '127.0.0.1',
		hmr: host
			? {
				protocol: "ws",
				host,
				port: 1421,
			}
			: undefined,
	},
	preview: {
		host: '127.0.0.1',
		port: 5173
	},
	define: {
		'import.meta.env.IS_MOBILE': JSON.stringify(IS_MOBILE),
		'process.env.NODE_ENV': process.env.NODE_ENV === 'production' ? '"production"' : '"development"',
	},
	resolve: process.env.VITEST
		? {
			conditions: ['browser']
		}
		: undefined,
	test: {
		coverage: {
			provider: 'istanbul', // or 'v8',
			include: ["src/**/*.ts"],
			exclude: ["src/sw.ts", "src/lib/menus.ts"]
		},
	},
});
