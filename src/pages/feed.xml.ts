import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getSortedPosts } from '../utils/posts';

export async function GET(context: APIContext) {
	const posts = (await getSortedPosts()).slice(0, 10);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site!,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.date,
			categories: post.data.tags,
			link: `/posts/${post.id}/`,
		})),
	});
}
