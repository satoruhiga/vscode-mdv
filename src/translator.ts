const cache = new Map<string, string>();
const CONCURRENCY = 5;

export async function translateBatch(
  texts: string[],
  from: string,
  to: string
): Promise<string[]> {
  const results: string[] = new Array(texts.length);
  const pending: { index: number; text: string }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const key = `${from}|${to}|${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) {
      results[i] = hit;
    } else {
      pending.push({ index: i, text });
    }
  }

  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const { index, text } = pending[cursor++];
      try {
        const translated = await translateOne(text, from, to);
        cache.set(`${from}|${to}|${text}`, translated);
        results[index] = translated;
      } catch {
        results[index] = text;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return results;
}

async function translateOne(text: string, from: string, to: string): Promise<string> {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx" +
    `&sl=${encodeURIComponent(from)}` +
    `&tl=${encodeURIComponent(to)}` +
    "&dt=t&ie=UTF-8&oe=UTF-8" +
    `&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("bad response");
  const segments = data[0] as Array<[string, ...unknown[]]>;
  return segments.map((s) => (typeof s[0] === "string" ? s[0] : "")).join("");
}

export function clearTranslationCache(): void {
  cache.clear();
}
