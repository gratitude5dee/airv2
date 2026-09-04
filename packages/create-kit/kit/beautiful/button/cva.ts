/**
 * Minimal class-variance-authority stand-in (the vendor snapshot has no cva).
 * Supports base classes, variants, defaultVariants and `className`.
 */
type ClassValue = string | false | null | undefined;

type VariantSchema = Record<string, Record<string, ClassValue>>;

type VariantSelection<V extends VariantSchema> = {
  [K in keyof V]?: keyof V[K] | null;
};

export type VariantProps<T> = T extends (props?: infer P) => string ? Omit<NonNullable<P>, "className"> : never;

export function cva<V extends VariantSchema>(
  base: ClassValue | ClassValue[],
  config?: { variants?: V; defaultVariants?: VariantSelection<V> }
) {
  return (props?: VariantSelection<V> & { className?: ClassValue }): string => {
    const out: string[] = [];
    for (const c of Array.isArray(base) ? base : [base]) if (c) out.push(c);
    const variants = config?.variants;
    if (variants) {
      for (const name of Object.keys(variants) as (keyof V)[]) {
        const chosen = props?.[name] ?? config?.defaultVariants?.[name];
        if (chosen == null) continue;
        const cls = variants[name]?.[chosen as string];
        if (cls) out.push(cls);
      }
    }
    if (props?.className) out.push(props.className);
    return out.join(" ");
  };
}
