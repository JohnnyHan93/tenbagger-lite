export type NewsItem = {
  title: string;
  date: string;
  url: string;
};

export type ResearchPack = {
  profile: string;
  website: string;
  wiki: string;
  customers: string[];
  techClaims: string[];
  news: NewsItem[];
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function emptyPack(): ResearchPack {
  return {
    profile: "",
    website: "",
    wiki: "",
    customers: [],
    techClaims: [],
    news: [],
  };
}

async function fetchOk(
  url: string,
  timeout = 9000,
  accept = "application/json,text/plain,*/*",
): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.text();
}

export function extractNamedCustomers(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    const n = name.replace(/\s+/g, " ").replace(/[.,;:]+$/g, "").trim();
    if (n.length < 3 || n.length > 48) return;
    if (!/^[A-Z0-9]/.test(n)) return;
    if (
      /discovery|science|modeling|logistics|cybersecurity|innovation|defense|computing|networking|sensing|security|solutions|performance|increase/i.test(
        n,
      )
    ) {
      return;
    }
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };

  const including = text.match(
    /(?:customers?(?: and partners)?|partners?|고객)\s+including\s+([A-Z][\s\S]{6,220}?)(?:\s+(?:achieve|achieved|to|for|across|in)\b|[.])/i,
  );
  if (including?.[1]) {
    for (const part of including[1].split(/,|\band\b|및|&/i)) push(part);
  }

  const known = [
    "Amazon Web Services",
    "AstraZeneca",
    "NVIDIA",
    "Microsoft",
    "Google",
    "IBM",
    "Lockheed Martin",
    "Airbus",
    "Hyundai",
    "Samsung",
    "SK hynix",
    "TSMC",
    "Amazon",
    "AWS",
  ];
  for (const k of known) {
    if (new RegExp(`\\b${k}\\b`, "i").test(text)) push(k);
  }
  return out.slice(0, 8);
}

export function extractTechClaims(text: string): string[] {
  if (!text) return [];
  const claims: string[] = [];
  const rec = text.match(/[^.]*world record[^.]*\./i);
  if (rec) claims.push(rec[0].trim());
  const fid = text.match(/[^.]*\d{2}\.\d+%[^.]{0,80}\./);
  if (fid) claims.push(fid[0].trim());
  const patent = text.match(/[^.]*patent[^.]*\./i);
  if (patent) claims.push(patent[0].trim());
  if (/quantum|trapped ion|photonic|foundry/i.test(text) && claims.length === 0) {
    claims.push("양자·첨단 하드웨어 키워드가 사업 설명에 등장.");
  }
  return claims.slice(0, 4);
}

export function parseRssItems(xml: string, limit = 6): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.split(/<item>/i).slice(1, limit + 1);
  for (const b of blocks) {
    const title = (b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .trim();
    const url = (b.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "").trim();
    const date = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "")
      .trim()
      .slice(0, 16);
    if (title) items.push({ title, date, url });
  }
  return items;
}

type NasdaqProfile = {
  data?: {
    CompanyDescription?: { value?: string };
    CompanyUrl?: { value?: string };
    Industry?: { value?: string };
    Sector?: { value?: string };
  };
};

async function nasdaqProfile(ticker: string): Promise<{ profile: string; website: string }> {
  if (ticker.includes(".")) return { profile: "", website: "" };
  const raw = await fetchOk(
    `https://api.nasdaq.com/api/company/${encodeURIComponent(ticker)}/company-profile`,
  );
  const json = JSON.parse(raw) as NasdaqProfile;
  return {
    profile: json.data?.CompanyDescription?.value ?? "",
    website: json.data?.CompanyUrl?.value ?? "",
  };
}

async function wikiSummary(name: string): Promise<string> {
  const q = name.replace(/,?\s*Inc\.?$/i, "").trim();
  if (!q) return "";
  const search = JSON.parse(
    await fetchOk(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=1&format=json&srlimit=1`,
    ),
  ) as { query?: { search?: Array<{ title?: string }> } };
  const title = search.query?.search?.[0]?.title;
  if (!title) return "";
  const page = JSON.parse(
    await fetchOk(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    ),
  ) as { extract?: string };
  return page.extract ?? "";
}

async function yahooNews(ticker: string): Promise<NewsItem[]> {
  const xml = await fetchOk(
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`,
    8000,
    "application/rss+xml,text/xml,*/*",
  );
  return parseRssItems(xml);
}

async function naverNews(code: string): Promise<NewsItem[]> {
  const raw = await fetchOk(
    `https://m.stock.naver.com/api/news/list?category=stock&stock=${code}&pageSize=6`,
  );
  const json = JSON.parse(raw) as Array<{
    title?: string;
    datetime?: string;
    officeId?: string;
    articleId?: string;
  }>;
  if (!Array.isArray(json)) return [];
  return json.slice(0, 6).map((n) => ({
    title: n.title ?? "",
    date: (n.datetime ?? "").slice(0, 10),
    url:
      n.officeId && n.articleId
        ? `https://n.news.naver.com/article/${n.officeId}/${n.articleId}`
        : "",
  })).filter((n) => n.title);
}

function krCode(ticker: string): string | null {
  const m = ticker.match(/^(\d{6})(?:\.(KS|KQ))?$/i);
  return m ? m[1]! : null;
}

export async function gatherResearchPack(input: {
  ticker: string;
  companyName: string;
  country: string;
}): Promise<ResearchPack> {
  const pack = emptyPack();
  const kr = krCode(input.ticker);
  const settled = await Promise.allSettled([
    nasdaqProfile(input.ticker),
    wikiSummary(input.companyName || input.ticker),
    yahooNews(input.ticker.replace(/\.(KS|KQ)$/i, "")),
    kr ? naverNews(kr) : Promise.resolve([] as NewsItem[]),
  ]);

  if (settled[0]?.status === "fulfilled") {
    pack.profile = settled[0].value.profile;
    pack.website = settled[0].value.website;
  }
  if (settled[1]?.status === "fulfilled") pack.wiki = settled[1].value;
  const news: NewsItem[] = [];
  if (settled[2]?.status === "fulfilled") news.push(...settled[2].value);
  if (settled[3]?.status === "fulfilled") news.push(...settled[3].value);
  pack.news = news.slice(0, 8);
  const blob = `${pack.profile}\n${pack.wiki}`;
  pack.customers = extractNamedCustomers(blob);
  pack.techClaims = extractTechClaims(blob);
  return pack;
}

export function packText(pack: ResearchPack): string {
  const lines = [
    pack.profile && `Profile: ${pack.profile}`,
    pack.wiki && `Wiki: ${pack.wiki}`,
    pack.website && `Website: ${pack.website}`,
    pack.customers.length ? `Named customers: ${pack.customers.join(", ")}` : "",
    pack.techClaims.length ? `Tech claims: ${pack.techClaims.join(" | ")}` : "",
    pack.news.length
      ? `News:\n${pack.news.map((n) => `- ${n.date} ${n.title} ${n.url}`).join("\n")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}
