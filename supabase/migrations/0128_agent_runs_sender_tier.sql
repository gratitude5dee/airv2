-- R-P0-2: carry the originating turn's sender tier on the run row itself.
-- Purchase and CRM callbacks resolve who initiated a turn from the run's
-- own tier, not from "latest row per user" timing, which let a tier-1
-- burst's open run read as the owner's composer.
--
-- NULL = unknown: legacy rows, bots, schedules, miniapp runs — every
-- resolver fails closed on NULL (not owner). Writers stamp 0 only where
-- the turn is the owner's by construction (chat/desktop/voice composer),
-- and the flush stamps the burst's tier verbatim.

alter table agent_runs add column sender_tier int;
