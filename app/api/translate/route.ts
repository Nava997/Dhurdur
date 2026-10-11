import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { validateRequest, translateRequestSchema, createAuditLog, logAudit } from '@/lib/validation';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEEPL_ENDPOINT = DEEPL_API_KEY?.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    // Verify internal API secret (Required since this is an Admin-only route)
    // Fails closed: if INTERNAL_API_SECRET isn't configured the route is disabled
    // instead of open to the internet (it spends the paid DeepL quota).
    const authHeader = req.headers.get('x-internal-secret') || '';
    const secret = process.env.INTERNAL_API_SECRET || '';
    const secretOk = secret.length > 0 && authHeader.length === secret.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(secret));
    if (!secretOk) {
      const auditLog = createAuditLog(req, undefined, undefined, 'translate', undefined, 'translation', false, 'Invalid internal API secret');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Unauthorized request' }, { status: 401 });
    }

    // Validate request body
    const body = await req.json();
    const validation = validateRequest(translateRequestSchema, body);

    if (!validation.success) {
      const auditLog = createAuditLog(req, userId, undefined, 'translate', undefined, 'translation', false, 'Validation failed', { errors: validation.errors.flatten() });
      logAudit(auditLog);
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.flatten() },
        { status: 400 }
      );
    }

    const { text, targetLang } = validation.data;

    if (!DEEPL_API_KEY) {
      return NextResponse.json({ error: 'Translation service not configured' }, { status: 503 });
    }

    // Map the requested lang to DeepL's expected format (e.g. EN -> EN-US)
    const deeplTargetLang = targetLang.toUpperCase() === 'EN' ? 'EN-US' : targetLang.toUpperCase();

    // Use DeepL API instead of MyMemory for much higher quality admin translations
    const response = await fetch(DEEPL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: [text], target_lang: deeplTargetLang, source_lang: 'DE' }),
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("DeepL Admin Translation Error:", errText);
      const auditLog = createAuditLog(req, userId, undefined, 'translate', undefined, 'translation', false, `DeepL API error: ${response.status}`);
      logAudit(auditLog);
      return NextResponse.json({ error: 'Translation service unavailable' }, { status: 502 });
    }

    const data = await response.json();
    const translatedText = data.translations[0]?.text || text;

    const auditLog = createAuditLog(req, userId, undefined, 'translate', undefined, 'translation', true, undefined, {
      sourceLang: 'DE',
      targetLang: deeplTargetLang,
      textLength: text.length,
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    return NextResponse.json({ success: true, translatedText }, { status: 200 });
  } catch (error) {
    console.error("Translate API Error:", error);
    const auditLog = createAuditLog(req, userId, undefined, 'translate', undefined, 'translation', false, error instanceof Error ? error.message : 'Failed to translate', {
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    return NextResponse.json(
      { error: 'Failed to translate' },
      { status: 500 }
    );
  }
}