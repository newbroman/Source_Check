// Run: node tests/matcher.test.js
const assert = require('assert');
const M = require('../matcher.js');

const data = { entries: [
  { domain: 'rt.com', name: 'RT', category: 'state-media' },
  { domain: 'news-pravda.com', name: 'Pravda hub', category: 'pravda-network' },
  { domain: 'pravda-fr.com', name: 'Pravda FR', category: 'pravda-network' },
  { domain: 'washingtonpost.pm', name: 'Fake WaPo', category: 'doppelganger' },
  { youtube: '@listedchannel', name: 'Listed', category: 'youtube' }
] };
const I = M.buildIndex(data);
const v = (s) => M.check(s, I).map(r => r.verdict);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('direct listed domain', () => assert.deepStrictEqual(v('https://www.rt.com/news/123'), ['listed']));
t('subdomain of listed hub', () => assert.deepStrictEqual(v('https://fr.news-pravda.com/x'), ['listed']));
t('mobile prefix stripped', () => assert.deepStrictEqual(v('https://m.rt.com/'), ['listed']));
t('bare domain in prose', () => assert.deepStrictEqual(v('read this pravda-fr.com/article today'), ['listed']));
t('facebook outbound wrapper unwrapped', () => {
  const r = M.check('https://l.facebook.com/l.php?u=https%3A%2F%2Frt.com%2Fnews%2F1&h=AT0', I)[0];
  assert.strictEqual(r.verdict, 'listed'); assert.ok(r.unwrapped);
});
t('google redirect unwrapped', () => assert.deepStrictEqual(v('https://www.google.com/url?q=https://pravda-fr.com/a&sa=U'), ['listed']));
t('doppelganger listed beats lookalike', () => assert.deepStrictEqual(v('https://washingtonpost.pm/a'), ['listed']));
t('unlisted TLD swap is lookalike', () => assert.deepStrictEqual(v('https://spiegel.ltd/a'), ['lookalike']));
t('hyphen clone is lookalike', () => assert.deepStrictEqual(v('https://fox-news.in/a'), ['lookalike']));
t('embedded loose brand', () => assert.deepStrictEqual(v('https://euronews-today.xyz/a'), ['lookalike']));
t('subdomain smuggling', () => assert.deepStrictEqual(v('https://bbc.co.uk.breaking.top/a'), ['lookalike']));
t('one-letter typo of long brand', () => assert.deepStrictEqual(v('https://theguardain.com/a'), ['lookalike']));
t('real outlets are clear', () => assert.deepStrictEqual(
  v('https://www.bbc.co.uk/news https://edition.cnn.com/x https://www.theguardian.com/uk https://www.spiegel.de/ https://www.dw.com/en'),
  ['clear', 'clear', 'clear', 'clear', 'clear']));
t('innocent similar names are clear', () => assert.deepStrictEqual(
  v('https://routers.com/ https://liberationnews.org/ https://weltwoche.ch/ https://dwell.com/ https://spiegelau.com/'),
  ['clear', 'clear', 'clear', 'clear', 'clear']));
t('google news is unknown', () => assert.strictEqual(M.check('https://news.google.com/articles/CBMiXyz', I)[0].reason, 'google-news'));
t('shortener is unknown', () => assert.strictEqual(M.check('https://bit.ly/abc', I)[0].reason, 'shortener'));
t('facebook post is unknown', () => assert.strictEqual(M.check('https://www.facebook.com/somepage/posts/123', I)[0].reason, 'facebook-post'));
t('youtube video pending', () => {
  for (const u of ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1', 'https://m.youtube.com/shorts/abcdefghijk']) {
    assert.strictEqual(M.check(u, I)[0].verdict, 'pending', u);
  }
});
t('youtube listed handle', () => assert.deepStrictEqual(v('https://www.youtube.com/@ListedChannel/videos'), ['listed']));
t('channel classification', () => {
  assert.strictEqual(M.classifyChannel({ author_url: 'https://www.youtube.com/@listedchannel', author_name: 'X' }, I).verdict, 'listed');
  assert.strictEqual(M.classifyChannel({ author_url: 'https://www.youtube.com/@someone', author_name: 'RT' }, I).verdict, 'lookalike');
  assert.strictEqual(M.classifyChannel({ author_url: 'https://www.youtube.com/@someone', author_name: 'Gardening Weekly' }, I).verdict, 'clear');
});
t('trailing punctuation and duplicates', () => assert.deepStrictEqual(v('See https://rt.com/a). Also https://rt.com/a'), ['listed']));
t('no links', () => assert.deepStrictEqual(v('just some words'), []));
t('registrable handles co.uk', () => assert.strictEqual(M.registrable('news.bbc.co.uk'), 'bbc.co.uk'));

console.log(`\n${n} tests passed`);
