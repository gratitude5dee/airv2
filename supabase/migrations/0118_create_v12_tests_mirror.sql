-- Air Create (V12) tests + mirror — docs/goal-create-v12.md §8.4, §10,
-- §14.2 item 3 (CR20, CR21, CR22).
--
-- miniapp_versions gains the two counters `air-create test` reports and the
-- mirror receipt for a production version. Counts and a commit sha only:
-- test ids, the test DSL and page text stay in the Box (`air.json`,
-- `.build/`); the mirrored source lives in the wzrd-create repository, never
-- here. `decisions.payload` is jsonb already and needs no change. Rows keep
-- their existing RLS (own-rows select, migration 0083). Forward-only.

alter table miniapp_versions
  add column if not exists tests_total smallint
    check (tests_total is null or tests_total between 0 and 40),
  add column if not exists tests_passed smallint
    check (tests_passed is null or tests_passed >= 0),
  add column if not exists mirrored_at timestamptz,
  add column if not exists mirror_commit text
    check (mirror_commit is null or mirror_commit ~ '^[0-9a-f]{7,64}$');

alter table miniapp_versions
  add constraint miniapp_versions_tests_passed_le_total
  check (tests_passed is null or tests_total is null or tests_passed <= tests_total);

comment on column miniapp_versions.tests_total is
  'V12 §8.4: declared air.json.tests[] count at the last `air-create test`; ids stay in the Box (CR21).';
comment on column miniapp_versions.tests_passed is
  'V12 CR22: passing tests at the last run; a dev release needs tests_passed = tests_total.';
comment on column miniapp_versions.mirrored_at is
  'V12 §10 (CR20): when this version''s scrubbed source landed in wzrd-create; null = not mirrored.';
comment on column miniapp_versions.mirror_commit is
  'V12 §10: the wzrd-create commit sha that carries this version; never a URL.';
