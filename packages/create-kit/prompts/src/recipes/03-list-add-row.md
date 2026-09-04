### List with an add row

The oldest mini-app shape: a `.panel` of `.item` rows and an `.addrow` at the bottom. No catalog component is required; `aicss/todo-list` is the ready-made version, `beautiful/task-rows` when rows carry status pills.

```tsx
const { state, update } = useAirState<{ items: { id: string; text: string; done: boolean }[] }>("list", { items: [] });
<section className="panel">
  {state.items.map((it) => (
    <label key={it.id} className="item row">
      <input type="checkbox" checked={it.done} onChange={() => toggle(it.id)} />
      <span className={it.done ? "muted" : ""}>{it.text}</span>
    </label>
  ))}
  <form className="addrow" onSubmit={add}>
    <input placeholder="Add…" />
    <button className="chip">Add</button>
  </form>
</section>
```

Rows are 44px, inputs 16px. Reorder by explicit up/down chips, not drag. Nothing animates except the new row's ≤ 300ms fade.
