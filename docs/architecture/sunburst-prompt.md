# Air architecture: GPT Image 2.5 Sunburst prompts

Three prompts for OpenAI's GPT Image 2.5 Sunburst, the precision tier of the GPT Image 2.5 family. Sunburst
accepts text plus reference images and renders dense labels well. Prompts A and C use the labels of the
code-verified system map (`docs/architecture/air-system-map.html`); Prompt A shortens two group headers and
adds a title. Prompt B uses simplified poster wording taken from the map.

**How to get the most accurate result**

1. For the exact map, use the exported PNG itself: `docs/architecture/air-system-map.png`. To restyle it, use **Prompt C**. Attach the full PNG as image 1, then the six zoomed crops in `docs/architecture/reference-crops/` so the model can read the small labels. Check every label against the PNG afterwards.
2. **Prompt A** draws a condensed map of about 90 labels from text alone. Expect to fix a few labels with an edit.
3. **Prompt B** draws a poster of about 25 labels for a deck or README. It renders cleanly in one shot.
4. Set the size explicitly. Use 2560x1920 (4:3) for Prompt A, 2560x1440 (16:9) for Prompt B, and 3360x3216 for Prompt C, the reference's own size (about 1.05:1). Edges must be multiples of 16. If your provider caps the size, keep the aspect ratio and scale down (for Prompt C, 2560x2448).
5. To fix a misspelled label, edit the image. Pass the generated image as input with a mask over just that label, if your client supports masks, and the prompt: "Change the label 'X' to exactly 'Y'. Change nothing else." Then re-check the neighbouring labels.

---

## Prompt A: condensed system map (text only)

```text
Create a precise technical system-architecture diagram for a product called Air. Landscape 4:3 (2560x1920). Style: a clean engineering schematic in flat vector, with rounded-rectangle nodes, thin 1px outlines and orthogonal right-angle connectors with small solid arrowheads. Use generous, even spacing on a strict grid. No 3D, no isometric view, no people, no logos, no icons, no decorative clutter.

TEXT RULE: The only text in the image is the strings in double quotes below. Draw each one exactly once, character for character, including the · separators, colons, port numbers, tildes and slashes. Never draw hex codes, font names, the section words used here (PALETTE, TYPE, LAYOUT, ARROWS), or the → symbol used here to describe arrows.

PALETTE: background deep atmospheric navy #071a35 with a very faint radial cloud glow at the top. Group panels slightly darker navy #05132a with thin dashed outlines. Nodes navy #0d2a52 with cream text #f1ebdd. Sky blue #8cc8ff for the model and inference path. Warm gold #f0c674 for security controls: solid gold arrows for approval and control paths, and one thick dashed gold rectangle for the Box. Soft coral #ff9f80 with a dashed outline for known gaps.
TYPE: an elegant serif (like Newsreader) for the title; a wide monospace (like Azeret Mono) for everything else. Group headers are small, uppercase and letter-spaced.

TITLE, top left: "Air — System Architecture". Under it: "One user · one agent · one computer".

LAYOUT: a wide left column (about two-thirds of the width) and a narrow right column. Each stacks its groups from top to bottom.

LEFT COLUMN
1. Group header "Channels". Six nodes in a row: "iMessage", "Web · /home", "Desktop app", "Email", "Calendar", "Voice · Location". A short grey arrow drops from each into the bar below.
2. Group header "Control plane · Next.js on Vercel". Inside it:
   - A thin full-width bar: "Host router · middleware.ts".
   - A row of five nodes, left to right: "Ingress", "Router", "Orchestrator", "Chat relay", "Jev turn router". "Router" has a small gold sub-label "trust tier 0 · 1 · 2". "Jev turn router" is outlined in sky blue with the sub-label "TypeSafe System One". Grey arrows run "Ingress" → "Router" → "Orchestrator". There is no arrow from "Orchestrator" to "Chat relay". "Chat relay" and "Jev turn router" are joined by two sky-blue arrows, one each way, labeled "route".
   - A grid of small tiles in three rows of five: "Mini-app loader", "Create builder", "Functions", "Creative studio", "Digital twin", "Commerce", "Wallet · x402", "Trade · Tape", "Kernel · Masterkey", "Connectors", "Mail review", "Schedules", "Onboarding", "Learning · Traces", "Fleet · Migration".
   - A bottom row of five nodes: "Box provisioner" (gold outline), "Box proxy" (gold outline), "Approvals" (gold outline, sub-label "decisions · Needs you"), "Sender", "Inference gateway" (sky-blue outline, sub-label "fast · balanced · deep").
3. One large rectangle with a thick dashed gold border, labeled "THE BOX · one isolated VM per user (Linux, or a Mac on Namespace)". Inside it:
   - Top row: "~/.hermes disk", "Dashboard :9119", and a wide sky-blue node "Hermes agent · api_server :8642".
   - Middle row: "taskrouter :1917" (sky-blue outline, sub-labels "local model router" and "Qwen2.5 1.5B · idle"), "OpenViking :1933", "air-vault" (gold outline), "Browser stack" (coral dashed outline, sub-label "Chrome --no-sandbox"), "Kernel CDP relay".
   - Bottom row: "air-learningd", "Skills · SOUL", "MCP clients", "Calendar sync", "Claude Code".
   Under the rectangle, one line of small coral text: "Known gaps: no outbound egress policy · the agent runs as a sudo-capable user that owns every Box secret".

RIGHT COLUMN, top to bottom
1. Group header "Public surfaces": "Mini-app viewers", "Muse agents".
2. Group header "Cloudflare edge · mini-app runtime": "air-dispatcher", "Per-app Workers", "air-outbound" (gold outline, sub-label "egress allowlist"), and to their right "air-muse", "air-create", "air-dev" (coral dashed outline).
3. Group header "Shared state · Postgres holds no durable content": "Supabase Postgres" (sub-label "routing · run ledger"), "Cloudflare R2", "KV · D1 · DO".
4. Group header "Capability plane · per-user credentials": a wide sky-blue node "Model providers", then "Tools · compute", "Creative · identity", "Money rails" (gold outline), "Social · ads".

ARROWS. Each arrow joins nodes already described above, named here by their exact labels. Never draw a new box for an arrow end. Draw each arrow label small, next to its arrow.
1. "Orchestrator" and "Chat relay" each drop a gold line. The two lines merge and enter "Hermes agent · api_server :8642". Label: "wake · POST /v1/runs · route token + key".
2. "Hermes agent · api_server :8642" → "Inference gateway", sky blue. Two stacked labels: "GATEWAY_TOKEN" and "tier name only".
3. "Inference gateway" → "Model providers", sky blue: "provider keys".
4. "Hermes agent · api_server :8642" → "Approvals", gold: "files decision".
5. "Approvals" → "Hermes agent · api_server :8642", gold: "approveRun".
6. "Approvals" → "Sender", grey, no label.
7. "Hermes agent · api_server :8642" → "Sender", grey: "reply · [card:]".
8. "Box proxy" → "Dashboard :9119", gold: "plugin paths". "Box proxy" → "Hermes agent · api_server :8642", gold: "api paths".
9. "Box provisioner" → the gold Box border, gold: "fork + .env".
10. "Host router · middleware.ts" → "Ingress", grey: "/api/inbound/*". "Host router · middleware.ts" → "Chat relay", grey: "/api/chat · desktop".
11. "Mini-app viewers" → "air-dispatcher", grey: "303 + ?t= token". "air-dispatcher" → "Per-app Workers", grey: "signed manifest". "Per-app Workers" → "air-outbound", grey: "every fetch()".
12. "air-outbound" → "Inference gateway", sky blue: "art_ runtime token · tier name".
13. "Muse agents" → "air-muse", grey: "OAuth 2.1 + PKCE".

Keep generous margins. No text may overlap a line or other text. The result must read as a precise, legible engineering diagram.
```

---

## Prompt B: hero poster (about 25 labels)

```text
A precise, elegant technical architecture poster for a product called Air. Landscape 16:9 (2560x1440). Flat vector on a deep atmospheric navy background (#071a35) with a soft radial cloud glow. Grid-aligned layout, orthogonal arrows, plenty of negative space. No icons, no people, no 3D.

TEXT RULE: The only text in the image is the strings in double quotes below. Draw each one exactly once, character for character. Never draw hex codes, font names, or these instructions.

PALETTE: cream (#f1ebdd) monospace labels on navy nodes. Sky blue (#8cc8ff) for the model path. Warm gold (#f0c674): one thick dashed rectangle for the Box, and solid arrows for approval paths.

Title, top left, in a refined serif: "Air". Under it, in monospace: "A private agent with its own number, inbox, computer and wallet".

LEFT TWO-THIRDS, three layers from top to bottom:
1. Small uppercase header "CHANNELS", then pill nodes "iMessage", "Web", "Desktop", "Email", "Calendar".
2. Small uppercase header "CONTROL PLANE", then nodes "Router · trust tiers", "Jev turn router", "Mini-app loader", "Approvals · Needs you", and, at the right end of the row, "Inference gateway".
3. No header. A large dashed gold rectangle labeled "THE BOX · one per user", holding one wide node "Hermes agent" and smaller nodes "taskrouter · idle", "OpenViking memory", "air-vault", "Browser + lease guard".

RIGHT THIRD, outside the Box: a column with the small uppercase header "CAPABILITIES" and, from top to bottom: "Model providers" (level with "Inference gateway"), "Composio · Kernel", "Stripe · x402 · thirdweb", "Creative models".

ARROWS (none of them crosses the Box rectangle):
- "Hermes agent" up to "Inference gateway", sky blue, labeled "tier name only".
- "Inference gateway" right to "Model providers", sky blue, labeled "provider keys".
- "Hermes agent" up to "Approvals · Needs you", solid gold, labeled "files decision".
- "Approvals · Needs you" right to "Stripe · x402 · thirdweb", solid gold, labeled "after owner approval".

Small footer, monospace: "Content lives on the Box · Postgres holds routing and ledgers".
```

---

## Prompt C: redraw from the reference image (most faithful)

Attach `docs/architecture/air-system-map.png` as image 1. Then attach the six crops from
`docs/architecture/reference-crops/` as images 2 to 7.

```text
Image 1 is a complete architecture diagram. Images 2 to 7 are zoomed crops of the same diagram, given only so you can read its small labels. Do not draw them as separate panels.

Redraw image 1 as a polished, publication-quality technical illustration. Keep the layout, grouping, node positions, arrows, arrow directions and every text label exactly as in image 1. Copy each label character for character, including the · separators, colons, port numbers, tildes, ~/ paths and double hyphens. Do not add, remove, translate or paraphrase any text, and do not merge or drop any node.

Finish: flat vector, crisp 1px outlines, rounded rectangles, orthogonal connectors with small solid arrowheads, consistent spacing, strict grid alignment. Palette: deep atmospheric navy background #071a35 with a faint radial cloud glow; group panels #05132a with dashed outlines; nodes #0d2a52; cream text #f1ebdd; sky blue #8cc8ff for the model and inference path; warm gold #f0c674 for security controls, approval arrows and the dashed Box border; soft coral #ff9f80 for known gaps. Title in an elegant serif, all other labels in a wide monospace. Output size 3360x3216, the same aspect ratio as image 1. Do not crop, pad or stretch. No icons, no 3D, no people, no watermark.
```
