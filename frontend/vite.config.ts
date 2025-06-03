import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasmPack from 'vite-plugin-wasm-pack';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from "vite-plugin-top-level-await";

const host = process.env.TAURI_DEV_HOST;
console.log(host)
export default defineConfig({
	clearScreen: false,

	plugins: [tailwindcss(), sveltekit(), wasm(), wasmPack(['./wasm-lib']), topLevelAwait()],

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
	}
});
