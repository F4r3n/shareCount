import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasmPack from 'vite-plugin-wasm-pack';
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), wasmPack(['./wasm-lib']), topLevelAwait()],
	server: {
		host: '127.0.0.1',
		port: 5173
	},
	preview: {
		host: '127.0.0.1',
		port: 5173
	},
	optimizeDeps: {
    exclude: ['wasm-lib']
  }
});
