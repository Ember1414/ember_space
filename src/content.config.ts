import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.enum(['zh', 'en']).default('zh'),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    name: z.string(),
    icon: z.string().default('📦'),
    description: z.string(),
    url: z.string().optional(),
    repo: z.string().optional(),
    tags: z.array(z.string()).default([]),
    year: z.number(),
    order: z.number().default(99),
  }),
});

const about = defineCollection({
  loader: glob({ pattern: 'about*.md', base: './src/content' }),
  schema: z.object({
    lang: z.enum(['zh', 'en']).default('zh'),
  }),
});

export const collections = { posts, projects, about };
