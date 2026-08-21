-- Persist the provider-owned handle needed to edit a live mini-app card.
-- Only iMessage provider guids are stored here; no user content or URLs.
-- Forward-only.

create table miniapp_card_sessions (
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null check (kind in (
    'computer','calendar','vault','browser','kanban','todo','onboarding',
    'connect','video','image','crm','analytics','inbox','pay','shop',
    'settings','ads'
  )),
  resource_id text not null,
  space_id    text not null,
  session     jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, kind, resource_id)
);

alter table miniapp_card_sessions enable row level security;
