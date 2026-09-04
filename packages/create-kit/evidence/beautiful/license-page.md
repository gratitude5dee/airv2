# Beautiful UI — license evidence

Captured 2026-09-04 from `https://beautifului.dev/license` (raw HTML alongside: `license-page.html`,
sha256 `826abff9bed5c70edb319d68ff4c83cd5aed1aa6a35d4451da1392ab8d036be5`).

Page headline: "Yes, you can use it for free." followed by the full MIT text:

```
MIT License

Copyright (c) 2026 Shane Levine

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Source distribution: there is no public git repository. Components are distributed only through
the shadcn-style registry at `https://beautifului.dev/r/registry.json` (items at `/r/<name>.json`,
`files[{path, content}]`). Captures under `upstream/` are the `content` fields verbatim; the
registry responses are hashed in `capture.json`.

Assessment: MIT, Tier A. The notice above must accompany copies — the Kit keeps it here and in
each component's meta.json (`license.spdx`, `author`).
