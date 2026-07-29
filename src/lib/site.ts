/**
 * Crown Point Glass — the Astro side of the shared helpers.
 *
 * This module does one thing the rest can't: reach into `astro:content` for
 * the validated settings. All the actual logic lives in ./business.ts, which
 * has no Astro imports and is unit-tested directly (see test/business.test.ts).
 * Pages import from here; nothing else should import `astro:content` for
 * settings.
 */
import { getEntry } from 'astro:content';
import type { BusinessSettings } from './business';

export async function getSettings() {
  const entry = await getEntry('settings', 'main');
  if (!entry) throw new Error('content/settings.yml is missing');
  return entry.data;
}

type Settings = Awaited<ReturnType<typeof getSettings>>;

// Compile-time guard: if the Zod schema in src/content.config.ts ever stops
// producing something the pure helpers can consume, this line fails `astro
// check` instead of the mismatch surfacing as a blank page at runtime.
const _settingsFitsBusiness = (s: Settings): BusinessSettings => s;
void _settingsFitsBusiness;

export {
  fullAddress,
  hasAddress,
  mapEmbedUrl,
  directionsUrl,
  telHref,
  ogImage,
  canonicalUrl,
  statusShort,
  hoursShort,
  hoursRows,
  openingHoursList,
  hoursData,
  jsonLd,
  breadcrumbLd,
  servicesLd,
} from './business';
