import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
	// Load Markdown files in the `src/content/posts/` directory.
	loader: glob({ base: './src/content/posts', pattern: '**/*.md' }),
	// Type-check frontmatter using a schema
	schema: z.object({
		title: z.string(),
		description: z.string(),
		// Transform string to Date object
		date: z.coerce.date(),
		lastModified: z.coerce.date().optional(),
		draft: z.boolean().default(false),
		// `tags:` may be left empty (null) in frontmatter
		tags: z
			.array(z.string())
			.nullish()
			.transform((tags) => tags ?? []),
	}),
});

export const collections = { posts };
