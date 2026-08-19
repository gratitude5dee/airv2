/**
 * First-party renderer module registry (MA1). The loader resolves the slug
 * against mini_apps first — a registry row with no module here (or a module
 * with no published row) does not load. Sessions D–I register their modules
 * here as their apps land.
 */
import type { MiniAppModule } from "./types";
import { calendar } from "./calendar";
import { computer } from "./computer";
import { crm } from "./crm";
import { inbox } from "./inbox";
import { kanban } from "./kanban";
import { browser } from "./passthrough";
import { todo } from "./todo";
import { vault } from "./vault";

export const FIRST_PARTY_MODULES: Record<string, MiniAppModule> = {
  browser,
  calendar,
  computer,
  crm,
  inbox,
  kanban,
  todo,
  vault,
};

export type { MiniAppContext, MiniAppModule } from "./types";
