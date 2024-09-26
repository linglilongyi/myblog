import { defaultCover } from '@/content/config.ts';
import { imageMetadata, type Image } from '@/helpers/images';
import options from '@/options';
import { getCollection, getEntry, type Render } from 'astro:content';

// Import the collections from the astro content.
const categoriesCollection = await getCollection('categories');
const friendsCollection = await getCollection('friends');
const pagesCollection = await getCollection('pages');
const postsCollection = await getCollection('posts');
const tagsCollection = await getCollection('tags');

// Redefine the types from the astro content.
export type Category = Omit<(typeof categoriesCollection)[number]['data'], 'cover'> & {
  counts: number;
  permalink: string;
  cover: Image;
};
export type Friend = (typeof friendsCollection)[number]['data'][number];
export type Page = Omit<(typeof pagesCollection)[number]['data'], 'cover'> & {
  slug: string;
  permalink: string;
  cover: Image;
  render: () => Render['.mdx'];
};
export type Post = Omit<(typeof postsCollection)[number]['data'], 'cover'> & {
  slug: string;
  permalink: string;
  cover: Image;
  render: () => Render['.mdx'];
  raw: () => Promise<string>;
};
export type Tag = (typeof tagsCollection)[number]['data'][number] & { counts: number; permalink: string };

// Translate the Astro content into the original content for dealing with different configuration types.
export const friends: Friend[] = friendsCollection[0].data;
// Override the website for local debugging
export const pages: Page[] = await Promise.all(
  pagesCollection
    .filter((page) => page.data.published || !options.isProd())
    .map(async (page) => ({
      slug: page.slug,
      permalink: `/${page.slug}`,
      render: async () => {
        const entry = await getEntry('pages', page.slug);
        return entry.render();
      },
      ...page.data,
      cover: await imageMetadata(page.data.cover),
    })),
);
export const posts: Post[] = (
  await Promise.all(
    postsCollection
      .filter((post) => post.data.published || !options.isProd())
      .map(async (post) => ({
        slug: post.slug,
        permalink: `/posts/${post.slug}`,
        render: async () => {
          const entry = await getEntry('posts', post.slug);
          return entry.render();
        },
        raw: async () => {
          const entry = await getEntry('posts', post.slug);
          return entry.body;
        },
        ...post.data,
        cover: await imageMetadata(post.data.cover),
      })),
  )
).sort((left: Post, right: Post) => {
  const a = left.date.getTime();
  const b = right.date.getTime();
  return options.settings.post.sort === 'asc' ? a - b : b - a;
});
export const categories: Category[] = await Promise.all(
  categoriesCollection.map(async (cat) => ({
    counts: posts.filter((post) => post.category === cat.data.name).length,
    permalink: `/cats/${cat.data.slug}`,
    ...cat.data,
    cover: await imageMetadata(cat.data.cover),
  })),
);
export const tags: Tag[] = tagsCollection[0].data.map((tag) => ({
  counts: posts.filter((post) => post.tags.includes(tag.name)).length,
  permalink: `/tags/${tag.slug}`,
  ...tag,
}));

// Find the missing categories from posts.
const missingCategories: string[] = posts
  .map((post) => post.category)
  .filter((c) => !categories.find((cat) => cat.name === c));
if (missingCategories.length > 0) {
  throw new Error(`The bellowing categories has not been configured:\n$${missingCategories.join('\n')}`);
}

// Find the missing tags from posts.
const missingTags: string[] = posts.flatMap((post) => post.tags).filter((tag) => !tags.find((t) => t.name === tag));
if (missingTags.length > 0) {
  throw new Error(`The bellowing tags has not been configured:\n$${missingTags.join('\n')}`);
}

// Find the missing covers from posts.
const missingCovers = posts
  .filter((post) => post.cover.src === defaultCover)
  .map((post) => ({ title: post.title, slug: post.slug }));
if (!options.isProd() && missingCovers.length > 0) {
  // We only warn here for this is a known improvement.
  console.warn(`The following ${missingCovers.length} posts don't have a cover.`);
  console.warn(missingCovers);
}

// Validate the posts and pages' slug and alias. They should be unique globally.
const postsSlugs = new Set<string>();
for (const post of posts) {
  if (postsSlugs.has(post.slug)) {
    throw new Error(`Duplicate post slug: ${post.slug}`);
  }
  postsSlugs.add(post.slug);

  for (const alias of post.alias) {
    if (postsSlugs.has(alias)) {
      throw new Error(`Duplicate alias ${alias} in post ${post.slug}`);
    }

    postsSlugs.add(alias);
  }
}
for (const page of pages) {
  if (postsSlugs.has(page.slug)) {
    throw new Error(`Page and post share same slug: ${page.slug}`);
  }
}

// Validate feature posts option.
const featurePosts: string[] = options.settings.post.feature ?? [];
const invalidFeaturePosts = featurePosts.filter((slug) => !postsSlugs.has(slug));
if (invalidFeaturePosts.length > 0) {
  throw new Error(`The bellowing feature posts are invalid:\n$${invalidFeaturePosts.join('\n')}`);
}

// Validate pinned categories.
const pinnedCategories: string[] = options.settings.post.category ?? [];
const invalidPinnedCategories = pinnedCategories.filter((c) => categories.find((e) => e.name === c));
if (invalidPinnedCategories.length > 0) {
  throw new Error(`The bellowing pinned categories are invalid:\n$${invalidPinnedCategories.join('\n')}`);
}

export const getPost = (slug: string): Post | undefined => {
  return posts.find((post) => post.slug === slug);
};

export const getPage = (slug: string): Page | undefined => {
  return pages.find((page) => page.slug === slug);
};

export const getCategory = (name?: string, slug?: string): Category | undefined => {
  return categories.find((c) => c.name === name || c.slug === slug);
};

export const getTag = (name?: string, slug?: string): Tag | undefined => {
  return tags.find((tag) => tag.name === name || tag.slug === slug);
};
