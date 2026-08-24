/**
 * Image Studio client editor (image.goal.md §MA-I3). Bundled to
 * public/creator-os/image-editor.js by scripts/build-image-editor.mjs and
 * mounted onto #image-editor — same-origin under script-src 'self', no
 * third-party JS. The server-rendered classic form view stays available at
 * ?classic=1 and remains the card/guest surface.
 *
 * The editor is a Toolcraft-style stage + settings rail over the box-side
 * ImageDoc: the document (creativeDocs.ts) stays the single persistence
 * contract, and every mutation round-trips through the mini-app action lane
 * (`format=json`) so the server reducer stays authoritative — the client
 * only previews continuous edits (sliders, drags) between commits.
 */
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import type {
  BlendMode,
  ImageDoc,
  ImageLayer,
  LayerTransform,
} from "../creativeDocs";

interface Payload {
  doc: ImageDoc;
  flatUrl: string | null;
  assetUrls: Record<string, string>;
  notice?: string | null;
}

const BLEND_MODES: readonly BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

async function postAction(
  fields: Record<string, string>
): Promise<Payload | null> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set("format", "json");
  try {
    const res = await fetch(window.location.pathname, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    return (await res.json()) as Payload;
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------- layer tree */

interface Row {
  layer: ImageLayer;
  depth: number;
  hidden: boolean;
}

/**
 * Display rows: siblings topmost-first at every level, with each group
 * header directly above its (indented) children.
 */
function treeRows(doc: ImageDoc): Row[] {
  const rows: Row[] = [];
  const emit = (parentId: string | null, depth: number, hidden: boolean): void => {
    const run = doc.layers.filter((layer) => layer.parentGroupId === parentId);
    for (const layer of [...run].reverse()) {
      rows.push({ layer, depth, hidden });
      if (layer.kind === "group") {
        emit(layer.id, depth + 1, hidden || layer.collapsed === true);
      }
    }
  };
  emit(null, 0, false);
  return rows;
}

function label(layer: ImageLayer): string {
  if (layer.name) return layer.name;
  if (layer.kind === "group") return "Group";
  if (layer.kind === "text") return layer.text || "Text";
  return layer.assetId || "Image";
}

function siblingIndex(doc: ImageDoc, layer: ImageLayer): number {
  return doc.layers
    .filter((l) => l.parentGroupId === layer.parentGroupId)
    .indexOf(layer);
}

/* --------------------------------------------------------------- panels */

function Panel({
  title,
  open = true,
  children,
}: {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  const [shown, setShown] = useState(open);
  return (
    <section className="ie-panel">
      <button
        type="button"
        className="ie-panel-head"
        onClick={() => setShown((s) => !s)}
        aria-expanded={shown}
      >
        <span>{title}</span>
        <span aria-hidden="true">{shown ? "\u2303" : "\u2304"}</span>
      </button>
      {shown ? <div className="ie-panel-body">{children}</div> : null}
    </section>
  );
}

function Slider({
  label: text,
  value,
  min,
  max,
  suffix = "",
  onPreview,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}): React.ReactElement {
  return (
    <label className="ie-field">
      <span className="ie-field-row">
        <span>{text}</span>
        <span className="ie-value">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onPreview(Number(event.target.value))}
        onPointerUp={(event) =>
          onCommit(Number((event.target as HTMLInputElement).value))
        }
        onKeyUp={(event) =>
          onCommit(Number((event.target as HTMLInputElement).value))
        }
      />
    </label>
  );
}

/* ------------------------------------------------------------ the editor */

function Editor({ initial }: { initial: Payload }): React.ReactElement {
  const [doc, setDoc] = useState<ImageDoc>(initial.doc);
  const [flatUrl, setFlatUrl] = useState<string | null>(initial.flatUrl);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>(
    initial.assetUrls
  );
  const [notice, setNotice] = useState<string | null>(initial.notice ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const pending = useRef(0);

  const apply = useCallback((payload: Payload | null): void => {
    if (!payload) {
      setNotice("that didn't save — try again.");
      return;
    }
    setDoc(payload.doc);
    setFlatUrl(payload.flatUrl);
    setAssetUrls(payload.assetUrls);
    if (payload.notice) setNotice(payload.notice);
  }, []);

  const send = useCallback(
    async (fields: Record<string, string>): Promise<void> => {
      const ticket = ++pending.current;
      const payload = await postAction(fields);
      // A stale response must not clobber a newer local preview.
      if (ticket === pending.current) apply(payload);
    },
    [apply]
  );

  const selected = doc.layers.find((l) => l.id === doc.selectedLayerId) ?? null;
  const rows = useMemo(() => treeRows(doc), [doc]);
  const groups = doc.layers.filter((l) => l.kind === "group");

  /* Local (uncommitted) preview of a continuous edit on one layer. */
  const preview = useCallback((id: string, patch: Partial<ImageLayer>): void => {
    setDoc((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id === id ? { ...layer, ...patch } : layer
      ),
    }));
  }, []);

  const previewTransform = useCallback(
    (id: string, patch: Partial<LayerTransform>): void => {
      setDoc((current) => ({
        ...current,
        layers: current.layers.map((layer) =>
          layer.id === id
            ? { ...layer, transform: { ...layer.transform, ...patch } }
            : layer
        ),
      }));
    },
    []
  );

  const commitTransform = useCallback(
    (id: string, transform: LayerTransform): void => {
      void send({
        action: "set-transform",
        id,
        x: String(transform.x),
        y: String(transform.y),
        scale: String(transform.scale),
        rotation: String(transform.rotation),
      });
    },
    [send]
  );

  /* ------------------------------------------------------------- stage */

  const stageRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    kind: "pan" | "layer";
    id?: string;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const onStagePointerDown = useCallback(
    (event: React.PointerEvent): void => {
      const target = event.target as HTMLElement;
      const layerEl = target.closest("[data-layer-id]") as HTMLElement | null;
      const id = layerEl?.dataset.layerId;
      const layer = id ? doc.layers.find((l) => l.id === id) : undefined;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      if (layer) {
        if (doc.selectedLayerId !== layer.id) {
          void send({ action: "select", id: layer.id });
        }
        gesture.current = {
          kind: "layer",
          id: layer.id,
          startX: event.clientX,
          startY: event.clientY,
          baseX: layer.transform.x,
          baseY: layer.transform.y,
        };
      } else {
        gesture.current = {
          kind: "pan",
          startX: event.clientX,
          startY: event.clientY,
          baseX: pan.x,
          baseY: pan.y,
        };
      }
    },
    [doc, pan, send]
  );

  const onStagePointerMove = useCallback(
    (event: React.PointerEvent): void => {
      const g = gesture.current;
      if (!g) return;
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (g.kind === "pan") {
        setPan({ x: g.baseX + dx, y: g.baseY + dy });
      } else if (g.id) {
        previewTransform(g.id, {
          x: Math.round(g.baseX + dx / zoom),
          y: Math.round(g.baseY + dy / zoom),
        });
      }
    },
    [previewTransform, zoom]
  );

  const onStagePointerUp = useCallback((): void => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.kind === "layer" && g.id) {
      const layer = doc.layers.find((l) => l.id === g.id);
      if (
        layer &&
        (layer.transform.x !== g.baseX || layer.transform.y !== g.baseY)
      ) {
        commitTransform(g.id, layer.transform);
      }
    }
  }, [commitTransform, doc]);

  const onWheel = useCallback((event: React.WheelEvent): void => {
    event.preventDefault();
    setZoom((z) =>
      Math.min(6, Math.max(0.1, z * (event.deltaY < 0 ? 1.08 : 1 / 1.08)))
    );
  }, []);

  /* ------------------------------------------------------- render layers */

  const layerStyle = (layer: ImageLayer): React.CSSProperties => ({
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: `translate(-50%,-50%) translate(${layer.transform.x}px,${layer.transform.y}px) rotate(${layer.transform.rotation}deg) scale(${layer.transform.scale / 100})`,
    mixBlendMode: layer.blend,
    opacity: layer.opacity / 100,
    cursor: "grab",
    outline:
      layer.id === doc.selectedLayerId
        ? "2px solid rgba(140,170,255,0.9)"
        : "none",
    outlineOffset: "2px",
    userSelect: "none",
  });

  const renderStageLayer = (layer: ImageLayer): React.ReactNode => {
    if (!layer.visible || layer.kind === "group") return null;
    if (layer.kind === "text") {
      return (
        <div
          key={layer.id}
          data-layer-id={layer.id}
          style={{
            ...layerStyle(layer),
            color: "#fff",
            font: "600 42px/1.15 system-ui,sans-serif",
            textShadow: "0 2px 14px rgba(0,0,0,0.55)",
            whiteSpace: "pre-wrap",
            textAlign: "center",
            maxWidth: "80%",
          }}
        >
          {layer.text}
        </div>
      );
    }
    const url = layer.assetId ? assetUrls[layer.assetId] : undefined;
    return url ? (
      <img
        key={layer.id}
        data-layer-id={layer.id}
        src={url}
        alt=""
        draggable={false}
        style={{ ...layerStyle(layer), maxWidth: "88%", maxHeight: "88%" }}
      />
    ) : (
      <div
        key={layer.id}
        data-layer-id={layer.id}
        style={{
          ...layerStyle(layer),
          padding: "0.8rem 1.1rem",
          border: "1px dashed rgba(255,255,255,0.4)",
          borderRadius: 10,
          color: "rgba(255,255,255,0.75)",
          font: "12px/1.3 ui-monospace,monospace",
        }}
      >
        {layer.assetId}
      </div>
    );
  };

  /* -------------------------------------------------------- layers panel */

  const onDrop = useCallback(
    (event: React.DragEvent, target: ImageLayer): void => {
      event.preventDefault();
      setDragOverId(null);
      const id = event.dataTransfer.getData("text/plain");
      const dragged = doc.layers.find((l) => l.id === id);
      if (!dragged || dragged.id === target.id) return;
      if (target.kind === "group" && dragged.parentGroupId !== target.id) {
        // Dropping onto a group nests into it (Toolcraft moveToGroup).
        void send({ action: "set-parent", id, parentGroupId: target.id });
        return;
      }
      if (dragged.parentGroupId !== target.parentGroupId) {
        void send({
          action: "set-parent",
          id,
          parentGroupId: target.parentGroupId ?? "",
        });
        return;
      }
      void send({
        action: "reorder",
        id,
        index: String(siblingIndex(doc, target)),
      });
    },
    [doc, send]
  );

  const layerRow = (row: Row): React.ReactNode => {
    if (row.hidden) return null;
    const { layer } = row;
    const isSelected = layer.id === doc.selectedLayerId;
    return (
      <div
        key={layer.id}
        className={`ie-row${isSelected ? " on" : ""}${dragOverId === layer.id ? " over" : ""}`}
        style={{ paddingLeft: `${0.4 + row.depth * 0.85}rem` }}
        draggable
        onDragStart={(event) =>
          event.dataTransfer.setData("text/plain", layer.id)
        }
        onDragOver={(event) => {
          event.preventDefault();
          setDragOverId(layer.id);
        }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(event) => onDrop(event, layer)}
        onClick={() => void send({ action: "select", id: layer.id })}
      >
        {layer.kind === "group" ? (
          <button
            type="button"
            className="ie-mini"
            aria-label={layer.collapsed ? "expand group" : "collapse group"}
            onClick={(event) => {
              event.stopPropagation();
              void send({ action: "toggle-collapsed", id: layer.id });
            }}
          >
            {layer.collapsed ? "\u203a" : "\u2304"}
          </button>
        ) : (
          <span className="ie-mini ie-kind" aria-hidden="true">
            {layer.kind === "text" ? "T" : "\u25a3"}
          </span>
        )}
        <span className="ie-name">{label(layer)}</span>
        <button
          type="button"
          className="ie-mini"
          aria-label={layer.visible ? "hide layer" : "show layer"}
          onClick={(event) => {
            event.stopPropagation();
            void send({ action: "toggle-visible", id: layer.id });
          }}
        >
          {layer.visible ? "\u25c9" : "\u25cb"}
        </button>
        <button
          type="button"
          className="ie-mini"
          aria-label="move layer up"
          onClick={(event) => {
            event.stopPropagation();
            void send({ action: "move", id: layer.id, direction: "down" });
          }}
        >
          {"\u2191"}
        </button>
        <button
          type="button"
          className="ie-mini"
          aria-label="move layer down"
          onClick={(event) => {
            event.stopPropagation();
            void send({ action: "move", id: layer.id, direction: "up" });
          }}
        >
          {"\u2193"}
        </button>
        <button
          type="button"
          className="ie-mini"
          aria-label="delete layer"
          onClick={(event) => {
            event.stopPropagation();
            void send({ action: "remove", id: layer.id });
          }}
        >
          {"\u00d7"}
        </button>
      </div>
    );
  };

  /* ------------------------------------------------------ generate / edit */

  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const runRender = async (kind: "generate" | "edit"): Promise<void> => {
    const text = (kind === "generate" ? prompt : editPrompt).trim();
    if (!text || busy) return;
    setBusy(kind === "generate" ? "Rendering\u2026" : "Applying edit\u2026");
    setNotice(null);
    apply(await postAction({ action: kind, prompt: text }));
    setBusy(null);
    if (kind === "generate") setPrompt("");
    else setEditPrompt("");
  };

  const exportPrivate = async (): Promise<void> => {
    setBusy("Exporting\u2026");
    const payload = await postAction({ action: "export" });
    setBusy(null);
    if (payload && "exportUrl" in payload) {
      setExportUrl((payload as Payload & { exportUrl?: string }).exportUrl ?? null);
      apply(payload);
    } else {
      setNotice("export failed — try again.");
    }
  };

  /* -------------------------------------------------------------- layout */

  const [title, setTitle] = useState(doc.title);
  useEffect(() => setTitle(doc.title), [doc.title]);
  const [nameDraft, setNameDraft] = useState(selected?.name ?? "");
  useEffect(
    () => setNameDraft(selected?.name ?? ""),
    [selected?.id, selected?.name]
  );

  return (
    <div className="ie-root">
      <div
        ref={stageRef}
        className="ie-stage"
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
        onWheel={onWheel}
      >
        <div
          className="ie-canvas"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          {flatUrl ? (
            <img src={flatUrl} alt="canvas" draggable={false} className="ie-flat" />
          ) : (
            <div className="ie-empty">
              No image yet — describe one in Generate.
            </div>
          )}
          {doc.layers.map(renderStageLayer)}
        </div>
        {notice ? (
          <div className="ie-notice" role="status">
            {notice}
            <button type="button" className="ie-mini" onClick={() => setNotice(null)}>
              {"\u00d7"}
            </button>
          </div>
        ) : null}
        {busy ? <div className="ie-busy">{busy}</div> : null}
        <div className="ie-toolbar">
          <button
            type="button"
            className="ie-tool"
            disabled={!doc.history.undo.length}
            aria-label="undo"
            onClick={() => void send({ action: "undo" })}
          >
            {"\u21b6"}
          </button>
          <button
            type="button"
            className="ie-tool"
            disabled={!doc.history.redo.length}
            aria-label="redo"
            onClick={() => void send({ action: "redo" })}
          >
            {"\u21b7"}
          </button>
          <span className="ie-sep" />
          <button
            type="button"
            className="ie-tool"
            aria-label="zoom out"
            onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}
          >
            {"\u2212"}
          </button>
          <button
            type="button"
            className="ie-tool ie-zoom"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="ie-tool"
            aria-label="zoom in"
            onClick={() => setZoom((z) => Math.min(6, z * 1.2))}
          >
            +
          </button>
        </div>
      </div>

      <aside className="ie-rail">
        <Panel title="Document">
          <form
            className="ie-inline"
            onSubmit={(event) => {
              event.preventDefault();
              void send({ action: "rename", title });
            }}
          >
            <input
              type="text"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="document title"
            />
            <button type="submit" className="ie-btn">
              Rename
            </button>
          </form>
        </Panel>

        <Panel title="Generate" open={!doc.flatAssetId}>
          <textarea
            rows={3}
            maxLength={1000}
            placeholder="Describe the image to create…"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button
            type="button"
            className="ie-btn ie-primary"
            disabled={!!busy || !prompt.trim()}
            onClick={() => void runRender("generate")}
          >
            Generate
          </button>
          <p className="ie-hint">Runs a metered render — up to a minute.</p>
        </Panel>

        {doc.flatAssetId ? (
          <Panel title="Edit">
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Describe the change — e.g. remove the background…"
              value={editPrompt}
              onChange={(event) => setEditPrompt(event.target.value)}
            />
            <button
              type="button"
              className="ie-btn ie-primary"
              disabled={!!busy || !editPrompt.trim()}
              onClick={() => void runRender("edit")}
            >
              Apply edit
            </button>
            <p className="ie-hint">Edits the canvas with a metered render.</p>
          </Panel>
        ) : null}

        <Panel title="Layers">
          <div className="ie-rows">
            {rows.map(layerRow)}
            {!doc.layers.length ? (
              <div className="ie-hint">no layers yet.</div>
            ) : null}
          </div>
          <form
            className="ie-inline"
            onSubmit={(event) => {
              event.preventDefault();
              const input = event.currentTarget.elements.namedItem(
                "text"
              ) as HTMLInputElement;
              if (input.value.trim()) {
                void send({ action: "add-text", text: input.value });
                input.value = "";
              }
            }}
          >
            <input type="text" name="text" placeholder="Add text layer…" maxLength={500} />
            <button type="submit" className="ie-btn">
              + T
            </button>
          </form>
          <form
            className="ie-inline"
            onSubmit={(event) => {
              event.preventDefault();
              const input = event.currentTarget.elements.namedItem(
                "assetId"
              ) as HTMLInputElement;
              if (input.value.trim()) {
                void send({ action: "add-asset", assetId: input.value });
                input.value = "";
              }
            }}
          >
            <input
              type="text"
              name="assetId"
              placeholder="Add asset layer (asset id)…"
              maxLength={128}
            />
            <button type="submit" className="ie-btn">
              + {"\u25a3"}
            </button>
          </form>
          <form
            className="ie-inline"
            onSubmit={(event) => {
              event.preventDefault();
              const input = event.currentTarget.elements.namedItem(
                "name"
              ) as HTMLInputElement;
              void send({ action: "add-group", name: input.value });
              input.value = "";
            }}
          >
            <input type="text" name="name" placeholder="Add group…" maxLength={120} />
            <button type="submit" className="ie-btn">
              + {"\u25a2"}
            </button>
          </form>
        </Panel>

        {selected ? (
          <Panel title={`Layer \u00b7 ${label(selected)}`}>
            <form
              className="ie-inline"
              onSubmit={(event) => {
                event.preventDefault();
                void send({
                  action: "rename-layer",
                  id: selected.id,
                  name: nameDraft,
                });
              }}
            >
              <input
                type="text"
                value={nameDraft}
                maxLength={120}
                placeholder="layer name…"
                onChange={(event) => setNameDraft(event.target.value)}
                aria-label="layer name"
              />
              <button type="submit" className="ie-btn">
                Name
              </button>
            </form>
            {selected.kind === "text" ? (
              <label className="ie-field">
                <span>Text</span>
                <input
                  type="text"
                  value={selected.text ?? ""}
                  maxLength={500}
                  onChange={(event) =>
                    preview(selected.id, { text: event.target.value })
                  }
                  onBlur={(event) =>
                    void send({
                      action: "set-text",
                      id: selected.id,
                      text: event.target.value,
                    })
                  }
                />
              </label>
            ) : null}
            <Slider
              label="Opacity"
              value={selected.opacity}
              min={0}
              max={100}
              suffix="%"
              onPreview={(value) => preview(selected.id, { opacity: value })}
              onCommit={(value) =>
                void send({
                  action: "set-opacity",
                  id: selected.id,
                  opacity: String(value),
                })
              }
            />
            <label className="ie-field">
              <span>Blend</span>
              <select
                value={selected.blend}
                onChange={(event) =>
                  void send({
                    action: "set-blend",
                    id: selected.id,
                    blend: event.target.value,
                  })
                }
              >
                {BLEND_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <Slider
              label="Scale"
              value={selected.transform.scale}
              min={1}
              max={400}
              suffix="%"
              onPreview={(value) =>
                previewTransform(selected.id, { scale: value })
              }
              onCommit={(value) =>
                commitTransform(selected.id, {
                  ...selected.transform,
                  scale: value,
                })
              }
            />
            <Slider
              label="Rotation"
              value={selected.transform.rotation}
              min={-180}
              max={180}
              suffix="\u00b0"
              onPreview={(value) =>
                previewTransform(selected.id, { rotation: value })
              }
              onCommit={(value) =>
                commitTransform(selected.id, {
                  ...selected.transform,
                  rotation: value,
                })
              }
            />
            <div className="ie-field-row ie-hint">
              <span>
                Position {selected.transform.x}, {selected.transform.y}
              </span>
              <button
                type="button"
                className="ie-mini"
                onClick={() =>
                  commitTransform(selected.id, {
                    ...selected.transform,
                    x: 0,
                    y: 0,
                  })
                }
              >
                reset
              </button>
            </div>
            <label className="ie-field">
              <span>Group</span>
              <select
                value={selected.parentGroupId ?? ""}
                onChange={(event) =>
                  void send({
                    action: "set-parent",
                    id: selected.id,
                    parentGroupId: event.target.value,
                  })
                }
              >
                <option value="">— root —</option>
                {groups
                  .filter((group) => group.id !== selected.id)
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {label(group)}
                    </option>
                  ))}
              </select>
            </label>
          </Panel>
        ) : null}

        {doc.flatAssetId ? (
          <Panel title="Export" open={false}>
            <button
              type="button"
              className="ie-btn ie-primary"
              disabled={!!busy}
              onClick={() => void exportPrivate()}
            >
              {"\u2913"} Export PNG (private link)
            </button>
            <button
              type="button"
              className="ie-btn"
              disabled={!!busy}
              onClick={async () => {
                setBusy("Publishing\u2026");
                apply(await postAction({ action: "export-public" }));
                setBusy(null);
              }}
            >
              Public link
            </button>
            {exportUrl ? (
              <a className="ie-export-link" href={exportUrl}>
                {exportUrl.slice(0, 80)}…
              </a>
            ) : null}
          </Panel>
        ) : null}

        <Panel title="Agent" open={false}>
          <form
            className="ie-inline"
            onSubmit={(event) => {
              event.preventDefault();
              const input = event.currentTarget.elements.namedItem(
                "text"
              ) as HTMLInputElement;
              if (input.value.trim()) {
                void send({ action: "prompt", text: input.value });
                input.value = "";
                setNotice("sent to your agent.");
              }
            }}
          >
            <input
              type="text"
              name="text"
              placeholder="Ask your agent — e.g. remove the background…"
              maxLength={2000}
            />
            <button type="submit" className="ie-btn">
              Send
            </button>
          </form>
        </Panel>

        <a className="ie-classic" href="?classic=1">
          Classic view
        </a>
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------------- styles */

const CSS = `
.ie-root{position:fixed;inset:0;display:flex;background:#0b0b10;color:#e8e8f0;font-family:var(--font-ui,ui-monospace,monospace);z-index:5}
.ie-stage{position:relative;flex:1;overflow:hidden;touch-action:none;cursor:grab}
.ie-canvas{position:absolute;inset:0;transform-origin:center center}
.ie-flat{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:82%;max-height:82%;border-radius:10px;pointer-events:none}
.ie-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.45);font-size:13px;border:1px dashed rgba(255,255,255,0.25);border-radius:12px;padding:2.4rem 2rem;white-space:nowrap}
.ie-toolbar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:2px;background:rgba(18,18,26,0.92);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:4px;box-shadow:0 6px 24px rgba(0,0,0,0.45)}
.ie-tool{background:transparent;border:0;color:#cfcfe0;min-width:34px;min-height:30px;border-radius:7px;cursor:pointer;font:12px/1 inherit;box-shadow:none;text-transform:none;padding:0 8px}
.ie-tool:hover{background:rgba(255,255,255,0.08);transform:none}
.ie-tool:disabled{opacity:0.35;cursor:default}
.ie-zoom{min-width:52px}
.ie-sep{width:1px;background:rgba(255,255,255,0.12);margin:4px 3px}
.ie-busy{position:absolute;left:50%;top:16px;transform:translateX(-50%);background:rgba(18,18,26,0.92);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:0.45rem 1rem;font-size:12px;letter-spacing:0.06em}
.ie-notice{position:absolute;left:50%;top:16px;transform:translateX(-50%);display:flex;align-items:center;gap:0.5rem;background:rgba(30,30,44,0.95);border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:0.5rem 0.8rem;font-size:12px;max-width:min(80%,34rem)}
.ie-rail{width:min(320px,42vw);overflow-y:auto;background:rgba(14,14,20,0.98);border-left:1px solid rgba(255,255,255,0.08);padding:0.5rem 0.6rem 1rem;display:flex;flex-direction:column;gap:0.2rem}
.ie-panel{border-bottom:1px solid rgba(255,255,255,0.07)}
.ie-panel-head{width:100%;display:flex;justify-content:space-between;align-items:center;background:transparent;border:0;color:rgba(232,232,240,0.75);font:500 10.5px/1 inherit;letter-spacing:0.14em;text-transform:uppercase;padding:0.7rem 0.2rem;cursor:pointer;box-shadow:none}
.ie-panel-head:hover{color:#fff;transform:none}
.ie-panel-body{display:flex;flex-direction:column;gap:0.55rem;padding:0 0.15rem 0.75rem}
.ie-field{display:flex;flex-direction:column;gap:0.3rem;font-size:11px;color:rgba(232,232,240,0.65)}
.ie-field-row{display:flex;justify-content:space-between;align-items:center}
.ie-value{color:rgba(232,232,240,0.9)}
.ie-root input[type=text],.ie-root textarea,.ie-root select{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e8e8f0;min-height:2.1rem;padding:0.35rem 0.6rem;font-size:12.5px;font-family:inherit;flex:1;min-width:0}
.ie-root textarea{resize:vertical;line-height:1.4}
.ie-root input[type=range]{accent-color:#8caaff;width:100%}
.ie-inline{display:flex;gap:0.4rem}
.ie-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:8px;color:#e8e8f0;min-height:2.1rem;padding:0.3rem 0.75rem;font:11px/1 inherit;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;box-shadow:none;white-space:nowrap}
.ie-btn:hover{background:rgba(255,255,255,0.14);transform:none}
.ie-btn:disabled{opacity:0.4;cursor:default}
.ie-primary{background:#e8e8f0;color:#101018;border-color:transparent}
.ie-primary:hover{background:#fff}
.ie-hint{color:rgba(232,232,240,0.45);font-size:10.5px;margin:0;line-height:1.4}
.ie-rows{display:flex;flex-direction:column;gap:2px;max-height:38vh;overflow-y:auto}
.ie-row{display:flex;align-items:center;gap:0.3rem;border:1px solid transparent;border-radius:8px;padding:0.3rem 0.4rem;font-size:12px;cursor:pointer;user-select:none}
.ie-row:hover{background:rgba(255,255,255,0.05)}
.ie-row.on{background:rgba(140,170,255,0.14);border-color:rgba(140,170,255,0.4)}
.ie-row.over{border-color:rgba(140,170,255,0.8)}
.ie-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ie-mini{background:transparent;border:0;color:rgba(232,232,240,0.55);min-width:22px;min-height:22px;border-radius:6px;cursor:pointer;font:11px/1 inherit;box-shadow:none;padding:0 4px;text-transform:none}
.ie-mini:hover{color:#fff;background:rgba(255,255,255,0.1);transform:none}
.ie-kind{cursor:default}
.ie-kind:hover{background:transparent}
.ie-export-link{color:#8caaff;font-size:11px;word-break:break-all}
.ie-classic{color:rgba(232,232,240,0.4);font-size:10.5px;text-align:center;padding:0.8rem 0 0;text-decoration:none}
.ie-classic:hover{color:rgba(232,232,240,0.8)}
@media(max-width:720px){.ie-root{flex-direction:column}.ie-rail{width:100%;max-height:46vh;border-left:0;border-top:1px solid rgba(255,255,255,0.08)}}
`;

const mount = document.getElementById("image-editor");
if (mount) {
  let initial: Payload | null = null;
  try {
    initial = JSON.parse(mount.dataset.payload ?? "") as Payload;
  } catch {
    initial = null;
  }
  if (initial) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    createRoot(mount).render(
      <StrictMode>
        <Editor initial={initial} />
      </StrictMode>
    );
  }
}
