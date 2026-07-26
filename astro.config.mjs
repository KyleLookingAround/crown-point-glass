// Crown Point Glass — Astro configuration.
//
// The site is served from its own domain (crownpointglass.co.uk via
// public/CNAME), so there is no `base` path — asset/script URLs resolve at the
// domain root. Internal links in the pages are relative (./services.html).
// `build.format: 'file'` gives flat, shareable URLs (services.html,
// emergency.html…) rather than directory-style ones.
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://crownpointglass.co.uk',
  trailingSlash: 'ignore',
  build: { format: 'file' },
  integrations: [
    sitemap({
      // build.format 'file' serves pages as /services.html — put that real URL
      // in the sitemap (the integration would otherwise drop the extension)
      serialize: (item) => {
        const url = new URL(item.url);
        if (url.pathname !== '/' && !url.pathname.endsWith('.html')) {
          item.url = item.url.replace(/\/?$/, '.html');
        }
        return item;
      },
    }),
  ],
});
