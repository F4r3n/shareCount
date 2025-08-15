import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit'
import { generateSW } from './generateSW.mjs';

const host = process.env.TAURI_DEV_HOST;
const IS_MOBILE = process.env.TAURI_ENV_PLATFORM != undefined;
const plugins = [tailwindcss(),
sveltekit()];

if (!IS_MOBILE) {
	plugins.push(SvelteKitPWA({
		srcDir: './src',
		registerType: 'autoUpdate',
		strategies: generateSW ? "generateSW" : "injectManifest",
		filename: "sw.ts",
		devOptions: {
			enabled: process.env.NODE_ENV === "development",
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
	envPrefix: ['VITE_', 'TAURI_ENV_*'],
	define: {
		'import.meta.env.IS_MOBILE': IS_MOBILE,
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
