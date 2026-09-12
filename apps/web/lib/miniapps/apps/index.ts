/**
 * First-party renderer module registry (MA1). The loader resolves the slug
 * against mini_apps first — a registry row with no module here (or a module
 * with no published row) does not load. Sessions D–I register their modules
 * here as their apps land.
 */
import type { MiniAppModule } from "./types";
import { ads } from "./ads";
import { analytics } from "./analytics";
import { berd } from "./berd";
import { buzz } from "./buzz";
import { calendar } from "./calendar";
import { computer } from "./computer";
import { connect } from "./connect";
import { crm } from "./crm";
import { draw } from "./draw";
import { feedback } from "./feedback";
import { freeze } from "./freeze";
import { home } from "./home";
import { image } from "./image";
import { inbox } from "./inbox";
import { kanban } from "./kanban";
import { masterkey } from "./masterkey";
import { onboarding } from "./onboarding";
import { browser } from "./passthrough";
import { pay } from "./pay";
import { persona } from "./persona";
import { shop } from "./shop";
import { settings } from "./settings";
import { todo } from "./todo";
import { trade } from "./trade";
import { vault } from "./vault";
import { video } from "./video";

export const FIRST_PARTY_MODULES: Record<string, MiniAppModule> = {
  ads,
  analytics,
  berd,
  browser,
  buzz,
  calendar,
  image,
  computer,
  connect,
  crm,
  // Product-freeze exception (review CA-19): /draw is an explicitly
  // requested parity port from mayor-coast — owner-scoped, no third-party
  // surface; also adds the 'draw' card kind + mini_apps row.
  draw,
  feedback,
  // Same CA-19 shape as /draw: owner-scoped camera-move studio riding the
  // metered creative lanes; adds the 'freeze' card kind + mini_apps row.
  freeze,
  home,
  inbox,
  kanban,
  masterkey,
  onboarding,
  pay,
  persona,
  settings,
  shop,
  todo,
  trade,
  vault,
  video,
};

export type { MiniAppContext, MiniAppModule } from "./types";
