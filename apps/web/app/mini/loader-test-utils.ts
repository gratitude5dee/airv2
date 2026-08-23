/**
 * Test doubles for the MA1 loader: an in-memory mini_apps registry,
 * miniapp_redemptions (single-use jti), miniapp_guest_grants, and a
 * fire-and-forget miniapp_gate_events sink — just enough of the supabase
 * query surface the loader and gates touch.
 */
import type { RegistryApp } from "@/lib/miniapps/registry";
import type { GuestGrant } from "@/lib/miniapps/guests";

export function makeApp(overrides: Partial<RegistryApp>): RegistryApp {
  return {
    id: `app-${overrides.slug ?? "x"}`,
    slug: "browser",
    kind: "passthrough",
    owner_user_id: null,
    name: "Browser",
    description: "",
    icon_key: null,
    publisher_username: null,
    publisher_wallet: null,
    agent_identity: null,
    visibility: "private",
    access: "single",
    password_hash: null,
    x402_enabled: false,
    x402_price_usdc: null,
    plugin_signin_enabled: false,
    status: "published",
    bundle_version: null,
    listed_at: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export interface FakeDb {
  apps: RegistryApp[];
  grants: GuestGrant[];
  redeemedJtis: Set<string>;
  gateEvents: { app_id: string; kind: string; ref: string | null }[];
  opsEvents: { user_id: string | null; kind: string; ref: string | null }[];
  /** users.miniapp_home_order for the single test user. */
  homeOrder: string[];
}

/** Shared mutable db for vi.mock factories; tests seed it in beforeAll. */
export const testDb: FakeDb = {
  apps: [],
  grants: [],
  redeemedJtis: new Set(),
  gateEvents: [],
  opsEvents: [],
  homeOrder: [],
};

export function makeFakeSupabase(db: FakeDb) {
  return {
    from(table: string) {
      if (table === "mini_apps") {
        return {
          select() {
            return {
              eq(_col: string, value: string) {
                return {
                  async maybeSingle() {
                    return {
                      data: db.apps.find((a) => a.slug === value) ?? null,
                      error: null,
                    };
                  },
                };
              },
              is(_col: string, _value: null) {
                return {
                  async order() {
                    return {
                      data: db.apps.filter((a) => a.owner_user_id === null),
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "miniapp_redemptions") {
        return {
          async insert(row: { jti: string }) {
            if (db.redeemedJtis.has(row.jti)) {
              return { error: { code: "23505", message: "duplicate" } };
            }
            db.redeemedJtis.add(row.jti);
            return { error: null };
          },
        };
      }
      if (table === "miniapp_gate_events") {
        return {
          async insert(row: { app_id: string; kind: string; ref: string | null }) {
            db.gateEvents.push(row);
            return { error: null };
          },
        };
      }
      if (table === "miniapp_guest_grants") {
        return {
          select() {
            return {
              eq(_col: string, value: string) {
                return {
                  async maybeSingle() {
                    return {
                      data: db.grants.find((g) => g.id === value) ?? null,
                      error: null,
                    };
                  },
                };
              },
            };
          },
          update(patch: { uses: number }) {
            return {
              eq(_c1: string, id: string) {
                return {
                  eq(_c2: string, uses: number) {
                    return {
                      async select() {
                        const grant = db.grants.find(
                          (g) => g.id === id && g.uses === uses
                        );
                        if (!grant) return { data: [], error: null };
                        grant.uses = patch.uses;
                        return { data: [{ id }], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "users") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        miniapp_theme: "atmosphere",
                        miniapp_home_order: db.homeOrder,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          update(patch: { miniapp_home_order?: string[] }) {
            return {
              async eq() {
                if (patch.miniapp_home_order) {
                  db.homeOrder = patch.miniapp_home_order;
                }
                return { error: null };
              },
            };
          },
        };
      }
      if (table === "ops_events") {
        return {
          async insert(row: {
            user_id: string | null;
            kind: string;
            ref: string | null;
          }) {
            db.opsEvents.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`fake supabase: unexpected table ${table}`);
    },
  };
}
