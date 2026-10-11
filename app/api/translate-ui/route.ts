import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { adminDb } from '../../../lib/firebaseAdmin';
import { fallbackTranslations } from '@/lib/translations';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { validateRequest, translateUiRequestSchema, createAuditLog, logAudit } from '@/lib/validation';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEEPL_ENDPOINT = DEEPL_API_KEY?.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate';

const LANG_CODE_MAP: Record<string, string> = {
  en: 'EN-US',
  es: 'ES',
  fr: 'FR',
  it: 'IT',
  nl: 'NL',
  tr: 'TR',
  pl: 'PL',
  ru: 'RU',
  ar: 'AR',
  zh: 'ZH',
  ja: 'JA',
};

type LeafPath = string[];

// Keys whose values must never be sent to DeepL or changed (document ids, image links).
const KEEP_AS_IS = new Set(['id', 'images']);

function flatten(obj: any, path: LeafPath = [], out: { path: LeafPath; text: string }[] = []) {
  if (KEEP_AS_IS.has(path[path.length - 1])) return out;
  if (typeof obj === 'string') {
    // Do not send empty strings to DeepL or it will fail with a 400 error
    if (obj.trim() !== '') out.push({ path, text: obj });
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => flatten(item, [...path, String(i)], out));
  } else if (obj && typeof obj === 'object') {
    for (const key in obj) flatten(obj[key], [...path, key], out);
  }
  return out;
}

function unflatten(template: any, translatedTexts: Map<string, string>, path: LeafPath = []): any {
  if (KEEP_AS_IS.has(path[path.length - 1])) return template;
  if (typeof template === 'string') {
    if (template.trim() === '') return template;
    return translatedTexts.get(path.join('.')) ?? template;
  } else if (Array.isArray(template)) {
    return template.map((item, i) => unflatten(item, translatedTexts, [...path, String(i)]));
  } else if (template && typeof template === 'object') {
    const result: any = {};
    for (const key in template) result[key] = unflatten(template[key], translatedTexts, [...path, key]);
    return result;
  }
  return template;
}

const hashOf = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Admin-managed content (service names, stylist specialties, walk-in wait
 * text), read straight from Firestore. Never taken from the request: the
 * translation is cached and served to every visitor.
 */
async function loadDynamicSource() {
  const [servicesSnap, stylistsSnap, generalSnap] = await Promise.all([
    adminDb.collection('services').get(),
    adminDb.collection('stylists').get(),
    adminDb.doc('settings/general').get(),
  ]);
  const sortById = <T extends { id: string }>(items: T[]) => items.sort((a, b) => a.id.localeCompare(b.id));
  return {
    dynamicServices: sortById(servicesSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') }))),
    dynamicStylists: sortById(stylistsSnap.docs.map(d => ({
      id: d.id,
      services: Array.isArray(d.data().services) ? d.data().services.map(String) : [],
    }))),
    generalSettings: { walkinWaitTime: String(generalSnap.data()?.walkinWaitTime || '') },
  };
}

async function deeplTranslate(texts: string[], deeplLang: string): Promise<string[]> {
  // DeepL accepts up to 50 texts per request; chunk to be safe
  const CHUNK_SIZE = 50;
  const out: string[] = [];
  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const res = await fetch(DEEPL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texts.slice(i, i + CHUNK_SIZE), target_lang: deeplLang, source_lang: 'DE' }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error('DeepL Error:', await res.text());
      throw new Error(`DeepL API error: ${res.status}`);
    }
    const data = await res.json();
    out.push(...data.translations.map((t: { text: string }) => t.text));
  }
  return out;
}

async function translateTree(tree: any, deeplLang: string) {
  const leaves = flatten(tree);
  const translated = await deeplTranslate(leaves.map(l => l.text), deeplLang);
  const map = new Map<string, string>();
  leaves.forEach((leaf, i) => map.set(leaf.path.join('.'), translated[i]));
  return { result: unflatten(tree, map), count: leaves.length };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    // Changing the UI language is a public action: guests must be able to trigger this.
    if (!DEEPL_API_KEY) {
      const auditLog = createAuditLog(req, userId, undefined, 'translate_ui', undefined, 'translation_cache', false, 'DeepL API key not configured');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Translation service not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const validation = validateRequest(translateUiRequestSchema, body);
    if (!validation.success) {
      const auditLog = createAuditLog(req, userId, undefined, 'translate_ui', undefined, 'translation_cache', false, 'Validation failed', { errors: validation.errors.flatten() });
      logAudit(auditLog);
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.flatten() },
        { status: 400 }
      );
    }

    const { targetLang } = validation.data;
    const deeplLang = LANG_CODE_MAP[targetLang];
    if (!deeplLang) {
      return NextResponse.json({ error: `Language "${targetLang}" is not supported` }, { status: 400 });
    }

    // SECURITY: the source text always comes from the server (the built-in
    // German dictionary + Firestore content), never from the request — the
    // result is cached in settings/translations and shown to every visitor.
    const staticSource = fallbackTranslations.de;
    const dynamicSource = await loadDynamicSource();
    const staticHash = hashOf(staticSource);
    const dynamicHash = hashOf(dynamicSource);

    let cached: any;
    try {
      const snap = await adminDb.doc('settings/translations').get();
      cached = snap.exists ? snap.data()?.[targetLang] : undefined;
    } catch (cacheReadError) {
      console.error('Failed to read translation cache:', cacheReadError);
    }

    // Each half is only re-translated when its source actually changed, so
    // e.g. an admin editing the walk-in wait time doesn't re-translate the
    // whole interface.
    const staticOk = cached?._staticHash === staticHash;
    const dynamicOk = cached?._dynamicHash === dynamicHash;
    if (cached && staticOk && dynamicOk) {
      return NextResponse.json({ success: true, translatedDict: cached }, { status: 200 });
    }

    // Cache miss = real DeepL call; limit it so visitors can't drain the quota.
    if (!(await rateLimit('translate-ui', clientIp(req), 5, 60 * 60 * 1000))) {
      if (cached) return NextResponse.json({ success: true, translatedDict: cached }, { status: 200 });
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let stringsTranslated = 0;
    let translatedDict: any = { ...(cached || {}) };

    if (!staticOk) {
      const { result, count } = await translateTree(staticSource, deeplLang);
      translatedDict = { ...translatedDict, ...result };
      stringsTranslated += count;
    }
    if (!dynamicOk) {
      const { result, count } = await translateTree(dynamicSource, deeplLang);
      translatedDict = { ...translatedDict, ...result };
      stringsTranslated += count;
    }
    translatedDict._staticHash = staticHash;
    translatedDict._dynamicHash = dynamicHash;

    try {
      // Replace this language's entry wholesale (merge would keep stale list items).
      await adminDb.doc('settings/translations').set({ [targetLang]: translatedDict }, { mergeFields: [targetLang] });
    } catch (cacheError) {
      console.error('Failed to cache translation in Firestore:', cacheError);
    }

    logAudit(createAuditLog(req, userId, undefined, 'translate_ui', undefined, 'translation_cache', true, undefined, {
      targetLang,
      stringsTranslated,
      durationMs: Date.now() - startTime,
    }));

    return NextResponse.json({ success: true, translatedDict }, { status: 200 });
  } catch (error: any) {
    console.error('Translation Pipeline Error:', error);
    logAudit(createAuditLog(req, userId, undefined, 'translate_ui', undefined, 'translation_cache', false, error.message || 'Translation failed', {
      durationMs: Date.now() - startTime,
    }));
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
