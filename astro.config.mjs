// @ts-check

import sitemap from '@astrojs/sitemap';
import { defineConfig, envField, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://www.jyuch.dev',
	integrations: [
		sitemap({
			filter: (page) => {
				const { pathname } = new URL(page);
				// Exclude tag pages, paginated post listings (/posts/, /posts/2/, ...) and 404 quiz explanations (/404/a/, ...)
				return (
					!pathname.startsWith('/tags/') &&
					!/^\/posts\/(\d+\/)?$/.test(pathname) &&
					!pathname.startsWith('/404/')
				);
			},
		}),
	],
	markdown: {
		shikiConfig: {
			theme: 'github-light',
			langAlias: {
				Dockerfile: 'dockerfile',
			},
		},
	},
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Noto Sans JP',
			cssVariable: '--font-noto-sans-jp',
			weights: [300],
			fallbacks: ['sans-serif'],
		},
	],
	env: {
		schema: {
			ENABLE_GOOGLE_ANALYTICS: envField.boolean({
				context: 'server',
				access: 'public',
				default: false,
			}),
		},
	},
});
