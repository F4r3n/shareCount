import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'offline.html',
			precompress: false,
			strict: true,
		}),
		alias: {
			"@components": "src/components",
			"@stores": "src/stores"
		},
		prerender: {
			entries: ['*']
		},
	}
};

export default config;
