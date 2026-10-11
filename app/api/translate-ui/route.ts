import { NextRequest, NextResponse } from 'next/server';
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

function flatten(obj: any, path: LeafPath = [], out: { path: LeafPath; text: string }[] = []) {
  if (typeof obj === 'string') {
    // CRITICAL FIX: Do not send empty strings to DeepL or it will crash with a 400 error
    if (obj.trim() !== '') {
      out.push({ path, text: obj });
    }
  } else if (Array.isArray(obj)) {
    // CRITICAL FIX: Skip the images array entirely so we don't break image links
    if (path[path.length - 1] === 'images') return out;

    obj.forEach((item, i) => flatten(item, [...path, String(i)], out));
  } else if (obj && typeof obj === 'object') {
    for (const key in obj) flatten(obj[key], [...path, key], out);
  }
  return out;
}

function unflatten(template: any, translatedTexts: Map<string, string>, path: LeafPath = []): any {
  if (typeof template === 'string') {
    if (template.trim() === '') return template; // Return original empty string
    return translatedTexts.get(path.join('.')) ?? template;
  } else if (Array.isArray(template)) {
    if (path[path.length - 1] === 'images') return template; // Keep images array intact
    return template.map((item, i) => unflatten(item, translatedTexts, [...path, String(i)]));
  } else if (template && typeof template === 'object') {
    const result: any = {};
    for (const key in template) result[key] = unflatten(template[key], translatedTexts, [...path, key]);
    return result;
  }
  return template;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    // NOTE: We do NOT check for x-internal-secret here anymore!
    // Changing the UI language is a public action. Guests must be able to trigger this.

    if (!DEEPL_API_KEY) {
      const auditLog = createAuditLog(req, userId, undefined, 'translate_ui', undefined, 'translation_cache', false, 'DeepL API key not configured');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Translation service not configured' }, { status: 503 });
    }

    // Validate request body
    const body = await req.json();
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

    // SECURITY: always translate the server's own German dictionary. The
    // result is cached in settings/translations and served to every visitor,
    // so accepting a client-supplied sourceDict would let anyone rewrite the
    // site's text for all users.
    const sourceDict = fallbackTranslations.de;

    const deeplLang = LANG_CODE_MAP[targetLang];
    if (!deeplLang) {
      const auditLog = createAuditLog(req, userId, undefined, 'translate_ui', undefined, 'translation_cache', false, `Unsupported language: ${targetLang}`);
      logAudit(auditLog);
      return NextResponse.json(
        { error: `Language "${targetLang}" is not supported by DeepL` },
        { status: 400 }
      );
    }

    // Serve the cached translation if one exists (saves DeepL quota and
    // stops anonymous visitors from burning it by re-requesting).
    try {
      const cached = await adminDb.doc('settings/translations').get();
      const cachedDict = cached.exists ? cached.data()?.[targetLang] : undefined;
      if (cachedDict && typeof cachedDict === 'object' && Object.keys(cachedDict).length > 0) {
        return NextResponse.json({ success: true, translatedDict: cachedDict }, { status: 200 });
      }
    } catch (cacheReadError) {
      console.error('Failed to read translation cache:', cacheReadError);
    }

    // Only reached on a cache miss (a real DeepL call), so this limit just
    // stops anonymous visitors from draining the DeepL quota.
    if (!(await rateLimit('translate-ui', clientIp(req), 5, 60 * 60 * 1000))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const leaves = flatten(sourceDict);
    const texts = leaves.map(l => l.text);

    // DeepL accepts up to 50 texts per request on free tier; chunk to be safe
    const CHUNK_SIZE = 50;
    const translatedTexts: string[] = [];

    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      const chunk = texts.slice(i, i + CHUNK_SIZE);
      const res = await fetch(DEEPL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: chunk, target_lang: deeplLang, source_lang: 'DE' }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("DeepL Error:", errText);
        const auditLog = createAuditLog(req, userId, undefined, 'translate_ui', undefined, 'translation_cache', false, `DeepL API error: ${res.status}`, { error: errText });
        logAudit(auditLog);
        return NextResponse.json({ error: 'Translation service unavailable' }, { status: 502 });
      }

      const data = await res.json();
      translatedTexts.push(...data.translations.map((t: { text: string }) => t.text));
    }

    const translatedMap = new Map<string, string>();
    leaves.forEach((leaf, i) => translatedMap.set(leaf.path.join('.'), translatedTexts[i]));

    const translatedDict = unflatten(sourceDict, translatedMap);

    // Persist via Admin SDK (merge: true guarantees it creates the doc if it was manually deleted)
    try {
      await adminDb.doc('settings/translations').set({ [targetLang]: translatedDict }, { merge: true });
    } catch (cacheError) {
      console.error('Failed to cache translation in Firestore:', cacheError);
    }

    const auditLog = createAuditLog(req, userId, undefined, 'translate_ui', undefined, 'translation_cache', true, undefined, {
      targetLang,
      stringsTranslated: texts.length,
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    return NextResponse.json({ success: true, translatedDict }, { status: 200 });
  } catch (error: any) {
    console.error("Translation Pipeline Error:", error);
    const auditLog = createAuditLog(req, userId, undefined, 'translate_ui', undefined, 'translation_cache', false, error.message || 'Translation failed', {
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}