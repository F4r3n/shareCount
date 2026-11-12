/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type PluginOption } from 'vite';
import { withPwa } from '@vite-pwa/sveltekit';
import { generateSW } from './generateSW.mjs';

const host = process.env.TAURI_DEV_HOST;
const IS_MOBILE = process.env.TAURI_ENV_PLATFORM != undefined;

// SvelteKit 3: the configuration formerly in svelte.config.js lives here.
const kitConfig: Parameters<typeof sveltekit>[0] = {
	preprocess: vitePreprocess(),
	adapter: adapter({
		pages: 'build',
		assets: 'build',
		fallback: 'offline.html',
		precompress: false,
		strict: true,
	}),
	serviceWorker: {
		register: false,
	},
	files: {
		serviceWorker: generateSW ? undefined : 'src/sw.ts',
	},
};

const plugins: PluginOption[] = [tailwindcss()];

if (IS_MOBILE) {
	plugins.push(sveltekit(kitConfig));
} else {
	plugins.push(withPwa(kitConfig, {
		registerType: 'autoUpdate',
		strategies: generateSW ? "generateSW" : "injectManifest",
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
		generateSW: {
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
