import { getCollection } from 'astro:content';

/** Returns all posts sorted by date, newest first. Drafts are excluded from production builds. */
export async function getSortedPosts() {
	const posts = await getCollection('posts', ({ data }) => (import.meta.env.PROD ? !data.draft : true));
	return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Returns the URL path segment for a tag (e.g. `character encoding` -> `character-encoding`). */
export function tagSlug(tag: string) {
	return tag.trim().replace(/\s+/g, '-');
}
