## 4. Exclusions

Not in the Kit, so stop looking:

- **ReactBits** (`DavidHDev/react-bits`) — "MIT + Commons Clause": may compile into an app, may not be redistributed as source. Tier B: it never lives in Git or in this Kit; the Build Service resolves it from the restricted artifact (`restricted/README.md`). The 13 files under `apps/web/lib/miniapps/client/backgrounds/vendor/` are ReactBits ports and are governed by the same terms.
- **CanvasUI** (`DavidHDev/canvas-ui`) — same Commons Clause, and it needs WebGL2 + Three + experimental HTML-in-canvas. Excluded outright.
- **WebGL under lite** — `libraries/metal-fx` is the only WebGL component and is `lite="false"`; `AirMetalFx` renders its child on a flat plate when lite, reduced motion, or no WebGL. arlan's `arcade-pixel`, `fade-motion`, `chroma-glow`, `emboss` (WebGL) and Beautiful UI's `prompt-bar` (WebGL via `glimm`) are not harvested.
- **Pro / paid components** — AI CSS `file-diff`, `image-generation`, `inline-citations`, `comparison-table` are Pro (private, licensed). Only the ten free components are here.
- **Trade dress** — arlan's `amo`, `midjourney`, `figma`, `dia-gradient` reproduce other products' identities. Not harvested.
- **Proprietary icon fonts** — Beautiful UI `sidebar-nav` depends on `@central-icons-react`; every other icon import is rewritten to `lucide-react`.
- **Heavy** — Beautiful UI `insight-cards` (`liveline` charts), libraries.dev `img-fx`, Fancy's variable-font components (need the font), physics components other than `elastic-line` (`matter-js`).
- **Not available at harvest** — recorded as gaps in `kit.sources.json`, never fabricated: Beautiful UI `agent-screen` (registry lists it, `r/agent-screen.json` is 404), arlan `ransom-note` (depends on site-hosted imagery and a manifest that is not published).
