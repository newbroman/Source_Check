# Source Check

A phone app (PWA) that tells you whether a link comes from a documented Russian state-media or influence-operation website. You share a post or article to it from Facebook, YouTube, Chrome or Firefox, and it shows the result as a colour:

- **Red:** the site or channel is named in a published investigation or sanctions decision.
- **Amber:** the address imitates a real news outlet (Doppelganger-style), or a channel uses a state outlet's name.
- **Orange:** the site is not a documented Russian operation, but independent researchers rate its reliability low (under 40/100).
- **Green:** the site is not on any list. This does not mean the story is accurate.
- **Grey:** the link hides its destination (Google News links, link shorteners, Facebook posts).

All checks run on the phone. The one exception is YouTube: the video address is sent to YouTube (or to noembed.com as a fallback) to look up the channel's name.

Where a rating exists, every result also shows a 0–100 reliability score from Lin et al. (2023), *PNAS Nexus*, doi:10.1093/pnasnexus/pgad286. That score combines six independent rating sets for about 11,500 news sites (data: https://www.domain-quality.info, `quality.json`). It measures the publisher's track record, not its political leaning. Platforms such as YouTube, Facebook and Substack are not rated.

## Files
- `index.html` — the app (UI)
- `matcher.js` — the matching logic (unwrapping redirects, domain lookup, lookalike detection)
- `sources.json` — the merged list, built by `tools/build_sources.py` from `research/*.json`
- `sw.js`, `manifest.webmanifest`, icons — offline support, install, and the Android share target
- `tests/matcher.test.js` — run with `node tests/matcher.test.js`

## Where the list comes from
Every entry records who named it (`attributed_by`) and where (`source_url`):

- **State media:** ISD's audit of the EU ban on Russian state media, plus the Council of the EU's broadcast bans (2022 and 2024).
- **Pravda network / Portal Kombat:** DFRLab, NewsGuard, VIGINUM (via reporting), and CheckFirst's public dataset (MPL-2.0).
- **Doppelganger:** the 32 domains seized by the US Department of Justice (Sept 2024), plus EU DisinfoLab and Qurium.
- **Storm-1516 / CopyCop:** Recorded Future (Insikt Group), the French SGDSN/VIGINUM Storm-1516 report, and NewsGuard. Some of the German sites rely on the Gnida Project (volunteer researchers, working with CORRECTIV and NewsGuard); those entries are marked as such.

## Updating the list
Edit or add entries in `research/*.json`, then run:

    python3 tools/build_sources.py

Copies of the app that are already installed fetch the new list the next time they open with a connection.
