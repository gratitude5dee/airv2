### Form with confirmation

Collect a few fields, show a receipt. Components: shell `.panel` + `.row` inputs, `beautiful/button`, `beautiful/value-pill` on the receipt, `fancy/scramble-in` or `arlan/typer` for the "Sent" line.

```tsx
const [sent, setSent] = useState<null | Form>(null);
return sent ? (
  <section className="panel notice">
    <TyperText text="Sent." play="in" />
    <div className="row"><ValuePill label="Name" value={sent.name} /><ValuePill label="Date" value={sent.date} /></div>
  </section>
) : (
  <form className="panel" onSubmit={submit}>
    <label className="row"><span className="kicker">Name</span><input required maxLength={80} /></label>
    <label className="row"><span className="kicker">Date</span><input type="date" required /></label>
    <Button type="submit" variant="primary">Send</Button>
  </form>
);
```

Where does it go? Either `useAirState().save()` (the owner reads it in the Files tab) or a Functions `POST` (many submitters). Never email, never a webhook to a host. Validate with `zod` on both sides.
