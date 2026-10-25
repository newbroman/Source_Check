/* Source Check — link matching logic.
 * Works in the browser (window.Matcher) and in Node (module.exports) so it can be unit-tested.
 * Pure functions only: no network, no DOM.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Matcher = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Two-level public suffixes we care about (enough for news sites; not a full PSL).
  const TWO_LEVEL = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk',
    'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'com.br', 'com.ua', 'org.ua', 'in.ua',
    'kiev.ua', 'co.za', 'com.tr', 'com.pl', 'com.ru', 'msk.ru', 'spb.ru', 'com.cn', 'co.in',
    'co.il', 'com.mx', 'com.ar', 'co.kr', 'com.sg', 'com.my', 'com.ph', 'com.ng', 'co.ke',
    'com.pk', 'com.eg', 'com.sa', 'com.hk', 'com.tw', 'com.vn', 'com.co', 'com.pe', 'co.id',
    'com.es', 'com.pt', 'com.gr', 'com.cy', 'com.mt', 'co.at', 'or.at', 'com.ge', 'com.am',
    'com.kz', 'com.by', 'org.ru', 'net.ru', 'com.md', 'com.ro', 'com.hr', 'com.rs', 'co.rs'
  ]);

  // Real outlets that Russian operations are documented as imitating (Doppelganger,
  // Operation Overload/Matryoshka, Storm-1516). Used only for the lookalike check.
  //   labels: the bare name as it appears in the real domain
  //   genuine: the outlet's real domains (subdomains of these are genuine too)
  //   loose: long, distinctive names — also match when embedded in a longer name
  const BRANDS = [
    { brand: 'BBC', labels: ['bbc', 'bbcnews'], genuine: ['bbc.co.uk', 'bbc.com', 'bbci.co.uk', 'bbcgoodfood.com', 'bbcearth.com', 'bbcamerica.com', 'bbcworldwide.com', 'bbcstudios.com'] },
    { brand: 'Euronews', labels: ['euronews'], genuine: ['euronews.com'], loose: true },
    { brand: 'The Guardian', labels: ['theguardian'], genuine: ['theguardian.com', 'guardian.co.uk'], loose: true },
    { brand: 'The Washington Post', labels: ['washingtonpost'], genuine: ['washingtonpost.com', 'wapo.st'], loose: true },
    { brand: 'The New York Times', labels: ['nytimes', 'newyorktimes'], genuine: ['nytimes.com', 'nyt.com'], loose: true },
    { brand: 'Fox News', labels: ['foxnews'], genuine: ['foxnews.com', 'foxbusiness.com'] },
    { brand: 'Reuters', labels: ['reuters'], genuine: ['reuters.com', 'reutersagency.com', 'thomsonreuters.com', 'reut.rs'] },
    { brand: 'Le Monde', labels: ['lemonde'], genuine: ['lemonde.fr'] },
    { brand: 'Der Spiegel', labels: ['spiegel'], genuine: ['spiegel.de'] },
    { brand: 'Bild', labels: ['bild'], genuine: ['bild.de'] },
    { brand: 'Süddeutsche Zeitung', labels: ['sueddeutsche'], genuine: ['sueddeutsche.de', 'sz.de'], loose: true },
    { brand: 'FAZ', labels: ['faz'], genuine: ['faz.net'] },
    { brand: 'Die Welt', labels: ['welt'], genuine: ['welt.de'] },
    { brand: 'Deutsche Welle', labels: ['dw', 'deutschewelle'], genuine: ['dw.com'] },
    { brand: 'France 24', labels: ['france24'], genuine: ['france24.com'] },
    { brand: 'Libération', labels: ['liberation'], genuine: ['liberation.fr'] },
    { brand: 'Le Parisien', labels: ['leparisien'], genuine: ['leparisien.fr'] },
    { brand: 'Le Figaro', labels: ['lefigaro'], genuine: ['lefigaro.fr'] },
    { brand: 'BFM TV', labels: ['bfmtv'], genuine: ['bfmtv.com'] },
    { brand: '20 Minutes', labels: ['20minutes'], genuine: ['20minutes.fr'] },
    { brand: 'ANSA', labels: ['ansa'], genuine: ['ansa.it'] },
    { brand: 'Politico', labels: ['politico'], genuine: ['politico.com', 'politico.eu'] },
    { brand: 'CNN', labels: ['cnn'], genuine: ['cnn.com'] },
    { brand: 'Sky News', labels: ['skynews'], genuine: ['sky.com', 'skynews.com.au'] },
    { brand: 'NATO', labels: ['nato'], genuine: ['nato.int'] },
    { brand: 'Bellingcat', labels: ['bellingcat'], genuine: ['bellingcat.com'] },
    { brand: 'The Kyiv Independent', labels: ['kyivindependent'], genuine: ['kyivindependent.com'], loose: true },
    { brand: 'NewsGuard', labels: ['newsguard', 'newsguardtech'], genuine: ['newsguardtech.com', 'newsguardrealitycheck.com'] }
  ];

  const SHORTENERS = new Set(['t.co', 'bit.ly', 'tinyurl.com', 'ow.ly', 'buff.ly', 'is.gd', 'goo.gl', 'rb.gy', 'cutt.ly', 'shorturl.at', 'tiny.cc', 'lnkd.in', 'dlvr.it', 'fb.me', 'on.fb.me', 'trib.al', 'aje.io', 'ift.tt', 'shorturl.com', 's.id']);

  // Edit distance where swapping two neighbouring letters counts as one edit
  // (optimal string alignment), so "theguardain" is one step from "theguardian".
  function lev(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 1) return 2;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  // Find every link in a block of shared text. Accepts full URLs and bare domains ("rt.com/news").
  function extractUrls(text) {
    if (!text) return [];
    const out = [];
    const seen = new Set();
    const full = /https?:\/\/[^\s<>"'`]+/gi;
    let m;
    const cleaned = String(text);
    while ((m = full.exec(cleaned))) push(m[0]);
    if (!out.length) {
      // Bare domains, only when no full URL was present (avoids picking up e.g. "Mr.Smith").
      const bare = /(?:^|[\s(])((?:[a-z0-9-]+\.)+[a-z]{2,24}(?:\/[^\s<>"'`]*)?)/gi;
      while ((m = bare.exec(cleaned))) push('https://' + m[1]);
    }
    return out;

    function push(u) {
      u = u.replace(/[),.;:!?\]]+$/, ''); // trailing punctuation from prose
      try {
        const parsed = new URL(u);
        if (!/\./.test(parsed.hostname)) return;
        const key = parsed.href;
        if (!seen.has(key)) { seen.add(key); out.push(parsed.href); }
      } catch (e) { /* not a URL */ }
    }
  }

  // Strip redirect wrappers (Facebook outbound links, Google redirects, YouTube redirects).
  function unwrap(url) {
    let current = url;
    for (let i = 0; i < 5; i++) {
      let u;
      try { u = new URL(current); } catch (e) { return current; }
      const host = u.hostname.toLowerCase();
      let next = null;
      if (/(^|\.)facebook\.com$/.test(host) && /^\/l\.php/.test(u.pathname)) next = u.searchParams.get('u');
      else if (/^l\.instagram\.com$/.test(host)) next = u.searchParams.get('u');
      else if (/(^|\.)google\.[a-z.]+$/.test(host) && u.pathname === '/url') next = u.searchParams.get('q') || u.searchParams.get('url');
      else if (/(^|\.)youtube\.com$/.test(host) && u.pathname === '/redirect') next = u.searchParams.get('q');
      else if (/^out\.reddit\.com$/.test(host)) next = u.searchParams.get('url');
      else if (/(^|\.)ampproject\.org$/.test(host) && /^\/[a-z]\/s\//.test(u.pathname)) next = 'https://' + u.pathname.replace(/^\/[a-z]\/s\//, '');
      if (!next) return current;
      current = next;
    }
    return current;
  }

  function normaliseHost(host) {
    host = String(host || '').toLowerCase().replace(/\.$/, '');
    return host.replace(/^(www\d?|m|mobile|amp)\./, '');
  }

  function registrable(host) {
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const last2 = parts.slice(-2).join('.');
    if (TWO_LEVEL.has(last2)) return parts.slice(-3).join('.');
    return last2;
  }

  function isOrUnder(host, domain) {
    return host === domain || host.endsWith('.' + domain);
  }

  function buildIndex(data) {
    const domains = new Map();
    const youtube = new Map();
    const names = new Map();
    for (const e of (data && data.entries) || []) {
      if (e.domain) {
        const d = normaliseHost(e.domain);
        if (!domains.has(d)) domains.set(d, e);
      }
      if (e.youtube) {
        const h = String(e.youtube).toLowerCase().replace(/^@?/, '@');
        if (!youtube.has(h)) youtube.set(h, e);
      }
      if (e.name && e.category === 'state-media') names.set(e.name.toLowerCase(), e);
    }
    return { domains, youtube, names, data };
  }

  function lookupDomain(host, index) {
    const parts = host.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const candidate = parts.slice(i).join('.');
      const hit = index.domains.get(candidate);
      if (hit) return { entry: hit, matched: candidate };
    }
    return null;
  }

  function lookalike(host) {
    const reg = registrable(host);
    for (const b of BRANDS) if (b.genuine.some(g => isOrUnder(host, g))) return null;
    const label = reg.split('.')[0];
    const compact = label.replace(/[-_]/g, '');
    const tokens = label.split(/[-_]/);
    for (const b of BRANDS) {
      for (const L of b.labels) {
        const hit =
          compact === L ||
          tokens.includes(L) ||
          (b.loose && compact.includes(L)) ||
          (L.length >= 9 && lev(compact, L) <= 1);
        if (hit) return { brand: b.brand, real: b.genuine[0], how: compact === L ? 'same-name' : 'similar-name' };
      }
      // Real domain smuggled into a subdomain, e.g. bbc.co.uk.news-today.xyz
      for (const g of b.genuine) {
        if (host.includes(g + '.') || host.includes(g.replace(/\./g, '-'))) {
          return { brand: b.brand, real: b.genuine[0], how: 'subdomain' };
        }
      }
    }
    return null;
  }

  function youtubeInfo(u) {
    const host = normaliseHost(u.hostname);
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id ? { videoId: id } : null;
    }
    if (!isOrUnder(host, 'youtube.com')) return null;
    const p = u.pathname;
    if (p === '/watch' && u.searchParams.get('v')) return { videoId: u.searchParams.get('v') };
    let m = p.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/);
    if (m) return { videoId: m[1] };
    m = p.match(/^\/(@[\w.\-]+)/);
    if (m) return { handle: m[1].toLowerCase() };
    m = p.match(/^\/channel\/(UC[\w-]{10,})/);
    if (m) return { channelId: m[1] };
    m = p.match(/^\/(?:c|user)\/([\w.\-]+)/);
    if (m) return { legacyName: m[1].toLowerCase() };
    return { other: true };
  }

  // Check one URL. Returns a result object; YouTube videos come back with
  // verdict 'pending' and need an async channel lookup by the app.
  function checkUrl(rawUrl, index) {
    const finalUrl = unwrap(rawUrl);
    let u;
    try { u = new URL(finalUrl); } catch (e) {
      return { url: rawUrl, verdict: 'unknown', reason: 'bad-url' };
    }
    const host = normaliseHost(u.hostname);
    const base = { url: rawUrl, finalUrl, host, unwrapped: finalUrl !== rawUrl };

    const listed = lookupDomain(host, index);
    if (listed) return Object.assign(base, { verdict: 'listed', entry: listed.entry, matched: listed.matched });

    if (host === 'news.google.com') return Object.assign(base, { verdict: 'unknown', reason: 'google-news' });
    if (SHORTENERS.has(host)) return Object.assign(base, { verdict: 'unknown', reason: 'shortener' });

    const yt = youtubeInfo(u);
    if (yt) {
      if (yt.handle) {
        const e = index.youtube.get(yt.handle);
        return Object.assign(base, { youtube: yt, verdict: e ? 'listed' : 'clear', entry: e || null, platform: 'youtube' });
      }
      if (yt.videoId) return Object.assign(base, { youtube: yt, verdict: 'pending', platform: 'youtube' });
      return Object.assign(base, { youtube: yt, verdict: 'unknown', reason: 'youtube-other', platform: 'youtube' });
    }

    if (isOrUnder(host, 'facebook.com') || host === 'fb.watch') return Object.assign(base, { verdict: 'unknown', reason: 'facebook-post' });

    const look = lookalike(host);
    if (look) return Object.assign(base, { verdict: 'lookalike', lookalike: look });

    return Object.assign(base, { verdict: 'clear' });
  }

  // After the app fetches oEmbed data for a YouTube video, classify the channel.
  function classifyChannel(oembed, index) {
    const authorUrl = (oembed && oembed.author_url) || '';
    const name = ((oembed && oembed.author_name) || '').trim();
    const m = authorUrl.match(/youtube\.com\/(@[\w.\-]+)/i);
    const handle = m ? m[1].toLowerCase() : null;
    if (handle && index.youtube.has(handle)) return { verdict: 'listed', entry: index.youtube.get(handle), channel: name, handle };
    const byName = name && index.names.get(name.toLowerCase());
    if (byName) return { verdict: 'lookalike', nameMatch: byName, channel: name, handle };
    return { verdict: 'clear', channel: name, handle };
  }

  function check(text, index) {
    return extractUrls(text).map(u => checkUrl(u, index));
  }

  return { extractUrls, unwrap, normaliseHost, registrable, buildIndex, lookupDomain, lookalike, checkUrl, classifyChannel, check, BRANDS, _lev: lev };
});
