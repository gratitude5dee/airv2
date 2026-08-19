/**
 * Inline JSON-LD <script> for store pages (MA10). This is the one sanctioned
 * raw-HTML sink in the web app: JSON-LD must be an inline script element, and
 * React escapes text children of <script>, which would corrupt the JSON. The
 * payload is machine-built (JSON.stringify over registry metadata) and every
 * `<` is hardened to \u003c so a hostile description cannot smuggle a
 * `</script>` breakout. lib/security/redteam.test.ts scans app/ and
 * components/ to keep dangerouslySetInnerHTML off vault-facing surfaces;
 * this component lives here so that scan stays meaningful — do not import it
 * with user-controlled HTML, only with plain data objects.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
