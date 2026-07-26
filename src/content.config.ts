/**
 * Crown Point Glass — content collections.
 *
 * Each YAML file in /content is one collection with a single entry ("main"),
 * validated against a schema below at build time. A bad edit (missing field,
 * broken indentation, wrong type) fails the build with a clear message —
 * the previously deployed site stays live, so a mistake never ships.
 */
import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';
import { load, CORE_SCHEMA } from 'js-yaml';

// Wrap a whole YAML file as one entry so `getEntry(name, 'main')` returns it.
// CORE_SCHEMA keeps unquoted dates and phone-like numbers as plain strings
// rather than coercing them, which is what the /admin editor writes.
const single = (path: string) =>
  file(path, { parser: (text) => [{ id: 'main', ...(load(text, { schema: CORE_SCHEMA }) as Record<string, unknown>) }] });

// Image paths are stored as "/assets/…" (the form the /admin editor writes)
// and normalised to the relative "./assets/…" the pages need — every built
// page sits at the site root, so relative paths work directly on the domain.
const image = z.string()
  .regex(/^\/assets\//, 'image paths start with /assets/')
  .transform((path) => `.${path}`);

// Two-letter day codes (the /admin editor shows full day names but stores
// these) and 24-hour HH:MM times — the building blocks of the hours field.
const DAY = z.enum(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use 24-hour time, e.g. 08:00');

// The line drawings available to a service card (see ServiceIcon.astro).
const ICON = z.enum(['window', 'door', 'shield', 'pane', 'lock', 'van', 'mirror', 'shop']);

const settings = defineCollection({
  loader: single('content/settings.yml'),
  schema: z.object({
    url: z.string().url(),
    name: z.string().min(1),
    legalName: z.string().min(1),
    description: z.string().min(1),
    strapline: z.string().min(1),

    phone: z.string().min(1),
    emergencyPhone: z.string().min(1),
    email: z.string().email(),

    street: z.string().min(1),
    locality: z.string().min(1),
    region: z.string(),
    postcode: z.string().min(1),
    country: z.string().default('GB'),
    companyNumber: z.string().default(''),

    areasIntro: z.string(),
    areas: z.array(z.string()).min(1),

    facebook: z.string().url().optional(),
    instagram: z.string().url().optional(),
    instagramHandle: z.string().optional(),
    previewImage: image,

    // One structured source of truth for opening hours. Editors pick days
    // from a dropdown and type 24-hour times; the display table, the hero
    // short line, the status pill, the live open/closed pill and the Google
    // (schema.org) hours are all derived from this in src/lib/site.ts —
    // nothing to keep in sync by hand.
    hours: z.array(
      z.object({
        fromDay: DAY,
        toDay: z.union([DAY, z.literal('')]).default(''),
        closed: z.boolean().default(false),
        open: z.union([HHMM, z.literal('')]).default(''),
        close: z.union([HHMM, z.literal('')]).default(''),
      }).refine((r) => r.closed || (r.open !== '' && r.close !== ''), {
        message: 'set both an opening and closing time, or tick "closed"',
      }),
    ),
    emergencyNote: z.string(),
    credentials: z.array(z.object({ name: z.string(), url: z.string().url() })).default([]),
  }),
});

const home = defineCollection({
  loader: single('content/home.yml'),
  schema: z.object({
    eyebrow: z.string(),
    headline: z.object({ line1: z.string(), line2: z.string(), line3: z.string() }),
    tagline: z.string(),
    marquee: z.array(z.string()).min(1),
    emergency: z.object({
      label: z.string(),
      headline: z.string(),
      body: z.string(),
      cta: z.string(),
    }),
    story: z.object({
      label: z.string(),
      heading: z.string(),
      lede: z.string(),
      paragraphs: z.array(z.string()).min(1),
      signature: z.string(),
    }),
    inside: z.array(z.object({ title: z.string(), body: z.string() }))
      .length(3, 'the "what we do" section is three cards'),
    sectors: z.array(z.object({
      category: z.string(),
      name: z.string(),
      url: z.string().url().optional(),
      body: z.string(),
    })).min(1),
    quote: z.object({ text: z.string(), by: z.string(), image: image }),
    coverage: z.object({ image: image, caption: z.string(), blurb: z.string() }),
    callback: z.object({
      blurb: z.string(),
      action: z.string().default(''),
      fieldName: z.string().default('email'),
    }),
    community: z.object({ blurb: z.string() }),
  }),
});

const services = defineCollection({
  loader: single('content/services.yml'),
  schema: z.object({
    intro: z.string(),
    note: z.string(),
    services: z.array(z.object({
      icon: ICON,
      title: z.string(),
      body: z.string(),
      points: z.array(z.string()).default([]),
    })).min(1),
  }),
});

const gallery = defineCollection({
  loader: single('content/gallery.yml'),
  schema: z.object({
    intro: z.string(),
    photos: z.array(z.object({ src: image, caption: z.string() })).min(1),
  }),
});

const emergency = defineCollection({
  loader: single('content/emergency.yml'),
  schema: z.object({
    intro: z.string(),
    promise: z.string(),
    callouts: z.array(z.object({ title: z.string(), body: z.string() })).min(1),
    steps: z.array(z.object({ title: z.string(), body: z.string() })).min(1),
    notes: z.array(z.object({ label: z.string(), body: z.string() })).default([]),
  }),
});

const quote = defineCollection({
  loader: single('content/quote.yml'),
  schema: z.object({
    intro: z.string(),
    quoteTypes: z.array(z.object({ title: z.string(), body: z.string() })).min(1),
    checklist: z.array(z.string()).min(1),
    promise: z.string(),
  }),
});

export const collections = { settings, home, services, gallery, emergency, quote };
