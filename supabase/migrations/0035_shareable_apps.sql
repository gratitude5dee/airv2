-- Guest grants are restricted to access='multiplayer' apps (MA4): the grant
-- API and loader both refuse owner-only apps. Kanban and to-do are the
-- shareable first-party apps — their renderers declare guest actions — so
-- flip them to multiplayer; vault/calendar stay owner-only.
update mini_apps
set access = 'multiplayer', updated_at = now()
where slug in ('kanban', 'todo');
