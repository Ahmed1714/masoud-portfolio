import Anthropic from '@anthropic-ai/sdk';
import { getSettingsSync, type AIProvider } from './settings';

export class AIError extends Error {}

export const PROVIDER_LABEL: Record<AIProvider, string> = {
  claude: 'Claude',
  openai: 'ChatGPT',
  gemini: 'Gemini',
};

export function aiReady(): boolean {
  const { ai } = getSettingsSync();
  return Boolean(
    (ai.provider === 'claude' && ai.claudeKey) ||
      (ai.provider === 'openai' && ai.openaiKey) ||
      (ai.provider === 'gemini' && ai.geminiKey),
  );
}

/** One-shot text completion against whichever provider is selected in Settings. */
export async function aiComplete(system: string, user: string, provider?: AIProvider): Promise<string> {
  const { ai } = getSettingsSync();
  const p = provider ?? ai.provider;
  if (!navigator.onLine) throw new AIError('محتاج إنترنت عشان الذكاء الاصطناعي يشتغل.');

  if (p === 'claude') {
    if (!ai.claudeKey) throw new AIError('حط مفتاح Claude API في الإعدادات.');
    const client = new Anthropic({ apiKey: ai.claudeKey, dangerouslyAllowBrowser: true });
    try {
      const res = await client.beta.messages.create({
        model: ai.claudeModel,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort: 'low' },
        // If the model declines on a safety classifier, the API retries on a fallback model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      if (res.stop_reason === 'refusal') throw new AIError('Claude رفض الطلب ده. جرّب صياغة تانية.');
      return res.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim();
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Anthropic.AuthenticationError) throw new AIError('مفتاح Claude غلط.');
      if (e instanceof Anthropic.RateLimitError) throw new AIError('Claude: وصلت للحد المسموح، استنى شوية.');
      if (e instanceof Anthropic.APIError) throw new AIError(`Claude: ${e.message}`);
      throw new AIError('حصلت مشكلة في الاتصال بـ Claude.');
    }
  }

  if (p === 'openai') {
    if (!ai.openaiKey) throw new AIError('حط مفتاح OpenAI في الإعدادات.');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.openaiKey}` },
      body: JSON.stringify({
        model: ai.openaiModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new AIError(`ChatGPT: ${j?.error?.message ?? r.status}`);
    return String(j.choices?.[0]?.message?.content ?? '').trim();
  }

  if (!ai.geminiKey) throw new AIError('حط مفتاح Gemini في الإعدادات.');
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.geminiModel)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ai.geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
      }),
    },
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new AIError(`Gemini: ${j?.error?.message ?? r.status}`);
  return (j.candidates?.[0]?.content?.parts ?? [])
    .map((x: { text?: string }) => x.text ?? '')
    .join('')
    .trim();
}

/** Extracts the first JSON value from a model reply (models sometimes wrap it in ``` fences). */
export function parseJSON<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));
  if (start < 0 || end < start) throw new AIError('الرد مش بالشكل المتوقع، جرّب تاني.');
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

// ---------- Prompt library ----------

const BRAND = () => {
  const s = getSettingsSync();
  return `أنت مساعد شخصي لـ ${s.name}، مصمم موشن جرافيك وأنيميشن (Motion Graphics & Animation Designer). المستخدم بيتكلم عامية مصرية أو فصحى أو إنجليزي، وأحياناً بيخلط بينهم، والنص جاي من تحويل صوت لكتابة فممكن يكون فيه أخطاء إملائية أو كلمات متقطعة: افهم المقصود وصحّحه.`;
};

export type OutLang = 'egyptian' | 'fusha' | 'english' | 'same';
export const OUT_LANG_LABEL: Record<OutLang, string> = {
  same: 'نفس لغة الكلام',
  egyptian: 'عامية مصرية',
  fusha: 'عربي فصحى',
  english: 'English',
};
const langRule = (l: OutLang) =>
  ({
    same: 'اكتب بنفس اللغة/اللهجة اللي اتكلم بيها المستخدم.',
    egyptian: 'اكتب بالعامية المصرية الطبيعية.',
    fusha: 'اكتب بالعربية الفصحى السلسة.',
    english: 'Write in natural, fluent English.',
  })[l];

export const PLATFORMS = ['Facebook', 'Instagram', 'LinkedIn', 'X', 'TikTok', 'YouTube', 'Behance'] as const;

export const prompts = {
  clean: (lang: OutLang) => ({
    system: `${BRAND()}\nمهمتك: نظّف النص وصحّح الإملاء وعلامات الترقيم وقسّمه لفقرات بدون ما تغيّر المعنى أو تضيف أفكار. ${langRule(lang)} رجّع النص النهائي فقط بدون أي مقدمة.`,
  }),
  post: (platform: string, lang: OutLang, tone: string) => ({
    system: `${BRAND()}\nحوّل كلام المستخدم لبوست جاهز للنشر على ${platform}. النبرة: ${tone}. ${langRule(lang)}
- ابدأ بجملة افتتاحية قوية (hook).
- راعي طبيعة المنصة وطول البوست المناسب لها.
- أضف هاشتاجات مناسبة في الآخر (3-6) لو المنصة بتستخدمها.
- متخترعش معلومات أو أرقام مش موجودة في الكلام.
رجّع البوست فقط بدون شرح.`,
  }),
  message: (lang: OutLang, tone: string) => ({
    system: `${BRAND()}\nحوّل كلام المستخدم لرسالة منمّقة وواضحة جاهزة للإرسال. النبرة: ${tone}. ${langRule(lang)} حافظ على كل المعلومات المهمة. رجّع الرسالة فقط.`,
  }),
  tasks: () => ({
    system: `${BRAND()}\nاستخرج من كلام المستخدم قائمة مهام. رجّع JSON فقط بالشكل: [{"title": "...", "priority": 1|2|3, "due": "YYYY-MM-DD" أو null}] حيث 1 = عالية. تاريخ النهارده ${new Date().toISOString().slice(0, 10)}.`,
  }),
  journal: () => ({
    system: `${BRAND()}\nحوّل الكلام ده ليومية مكتوبة بصيغة المتكلم بأسلوب صادق ومرتب، من غير ما تضيف أحداث. رجّع JSON فقط: {"title": "عنوان قصير", "body": "النص", "mood": "إيموجي واحد يعبر عن المود"}`,
  }),
  contentIdeas: (niche: string, platform: string) => ({
    system: `${BRAND()}\nاقترح 8 أفكار محتوى قيّم ومميز في مجال: ${niche} لمنصة ${platform}. كل فكرة لازم تكون عملية وتفيد الجمهور وتبني البراند الشخصي. رجّع JSON فقط: [{"title": "...", "body": "وصف مختصر + الـ hook + شكل المحتوى (ريل/كاروسيل/بوست)"}]`,
  }),
  englishWord: () => ({
    system: `You are an English tutor for an Egyptian Arabic speaker. For the given English word or phrase, return JSON only: {"meaning": "المعنى بالعربي باختصار", "example": "one natural English example sentence"}`,
  }),
  englishCorrect: () => ({
    system: `You are a friendly English writing coach for an Egyptian Arabic speaker (a motion graphics designer).
1) Give the corrected, natural version of the text.
2) List the main mistakes with a short explanation in Egyptian Arabic.
3) Suggest 2-3 useful words or expressions to learn from this text.
Use short headings. Be encouraging.`,
  }),
  englishChat: () => ({
    system: `You are a patient English conversation partner. Reply in simple, natural English (2-4 sentences) and ask a follow-up question. If the learner made a mistake, add one line at the end starting with "💡" showing the correction.`,
  }),
};
