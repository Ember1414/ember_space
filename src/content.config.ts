import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        tags: z.array(z.string()).default([]),
        draft: z.boolean().default(false),
        lang: z.enum(['zh', 'en']).default('zh'),
        cover: image().optional(),
        coverAlt: z.string().trim().optional(),
        featured: z.boolean().default(false),
        series: z.string().optional(),
        translationKey: z.string().optional(),
      })
      .superRefine((data, ctx) => {
        if (data.cover && !data.coverAlt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['coverAlt'],
            message: 'coverAlt is required when cover is set',
          });
        }
      }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z
      .object({
        name: z.string(),
        description: z.string(),
        url: z.string().optional(),
        repo: z.string().optional(),
        tags: z.array(z.string()).default([]),
        year: z.number(),
        order: z.number().default(99),
        lang: z.enum(['zh', 'en']).default('zh'),
        featured: z.boolean().default(false),
        status: z.string().optional(),
        role: z.string().optional(),
        highlights: z.array(z.string()).default([]),
        image: image().optional(),
        imageAlt: z.string().trim().optional(),
      })
      .superRefine((data, ctx) => {
        if (data.image && !data.imageAlt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['imageAlt'],
            message: 'imageAlt is required when image is set',
          });
        }
      }),
});

const about = defineCollection({
  loader: glob({ pattern: 'about*.md', base: './src/content' }),
  schema: z.object({
    lang: z.enum(['zh', 'en']).default('zh'),
  }),
});

export const collections = { posts, projects, about };
