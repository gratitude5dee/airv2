alter table boxes add column if not exists provider_name text
  check (char_length(provider_name) between 1 and 63);
