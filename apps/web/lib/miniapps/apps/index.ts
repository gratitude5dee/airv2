/**
 * First-party renderer module registry (MA1). The loader resolves the slug
 * against mini_apps first — a registry row with no module here (or a module
 * with no published row) does not load. Sessions D–I register their modules
 * here as their apps land.
 */
import type { MiniAppModule } from "./types";
import { analytics } from "./analytics";
import { calendar } from "./calendar";
import { image } from "./image";
import { kanban } from "./kanban";
import { browser, computer } from "./passthrough";
import { todo } from "./todo";
import { vault } from "./vault";
import { video } from "./video";

export const FIRST_PARTY_MODULES: Record<string, MiniAppModule> = {
  analytics,
  browser,
  calendar,
  image,
  computer,
  kanban,
  todo,
  vault,
  video,
};

export type { MiniAppContext, MiniAppModule } from "./types";
