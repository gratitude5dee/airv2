# arlan.me vault — license evidence

Captured 2026-09-04 from `https://arlan.me/vault/` (raw HTML alongside: `vault-index.html`,
sha256 `c1c22df9923b440bfd0e3ed0c2f6338cb2470717c15b35c42cc9dc1ee118346b`).

The vault index and every study page end with the same footer:

> MIT → free to copy

where "MIT" is an anchor to `https://opensource.org/licenses/MIT`
(`<a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer" …>MIT</a> → free to copy`).
The same footer is present on each captured study page (color-depth, ghosty-reveal, holo,
liquid-ui, squircle, typer, ransom-note — one match per page).

`https://arlan.me/licenses/MIT` (the path the footer used to link) returns 404 as of the capture
date; the live link is the opensource.org text. There is no repository or `LICENSE` file for the
vault — the site itself is the license statement. Author line on the site: "Arlan Marat".

Assessment: MIT by author statement on the page that publishes the source. Tier A. The
statement covers the component source shown in each study's "full source" panel; it does not
obviously cover third-party artwork embedded by a study (see ransom-note gap in kit.sources.json)
or the third-party trade dress some studies recreate (amo, midjourney, figma, dia-gradient —
excluded).
