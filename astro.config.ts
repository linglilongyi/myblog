import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import { defineConfig, envField } from 'astro/config';
import options from './options';
import { astroImage } from './plugins/images';
import { upyun } from './plugins/upyun';

// https://astro.build/config
export default defineConfig({
  // This will override the import.meta.env.SITE. No need to introduce method.
  site: options.isProd() ? options.website : options.local.website,
  output: 'server',
  security: {
    checkOrigin: true,
  },
  experimental: {
    env: {
      schema: {
        // Postgres Database
        POSTGRES_HOST: envField.string({ context: 'server', access: 'secret' }),
        POSTGRES_PORT: envField.number({ context: 'server', access: 'secret' }),
        POSTGRES_USERNAME: envField.string({ context: 'server', access: 'secret' }),
        POSTGRES_PASSWORD: envField.string({ context: 'server', access: 'secret' }),
        POSTGRES_DATABASE: envField.string({ context: 'server', access: 'secret' }),
        // Artalk Comment
        ARTALK_HOST: envField.string({ context: 'server', access: 'secret' }),
      },
    },
  },
  integrations: [
    mdx({
      remarkPlugins: [astroImage],
    }),
    upyun({
      path: ['images', 'og', 'cats'],
    }),
  ],
  adapter: node({
    mode: 'standalone',
  }),
  markdown: {
    gfm: true,
    shikiConfig: {
      theme: 'solarized-light',
      wrap: false,
    },
  },
  server: {
    port: options.local.port,
  },
  devToolbar: {
    // I don't need such toolbar.
    enabled: false,
  },
  vite: {
    // Add this for avoiding the needless import optimize in Vite.
    optimizeDeps: { exclude: ['@napi-rs/canvas'] },
  },
  build: {
    assets: 'cats',
    assetsPrefix: options.assetsPrefix(),
  },
});
