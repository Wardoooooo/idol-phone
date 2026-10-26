-- Idol Phone cloud schema
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'My iPhone' check (char_length(title) <= 80),
  data jsonb not null default '{}'::jsonb,
  published_data jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_data_size check (pg_column_size(data) <= 1048576),
  constraint projects_published_size check (published_data is null or pg_column_size(published_data) <= 1048576)
);

create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists projects_published_idx on public.projects(published_at) where published_at is not null;

alter table public.projects enable row level security;

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete to authenticated using (owner_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.projects to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
for each row execute function public.touch_updated_at();

create or replace function public.enforce_project_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.projects where owner_id = new.owner_id) >= 3 then
    raise exception 'Project limit reached (max 3 per user)';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_limit on public.projects;
create trigger projects_limit before insert on public.projects
for each row execute function public.enforce_project_limit();

create or replace function public.get_shared_project(p_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', id,
    'title', title,
    'data', published_data,
    'published_at', published_at
  )
  from public.projects
  where id = p_id and published_at is not null and published_data is not null;
$$;

revoke all on function public.get_shared_project(uuid) from public;
grant execute on function public.get_shared_project(uuid) to anon, authenticated;

-- Storage bucket for uploaded images / audio
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/wav','audio/ogg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists media_owner_insert on storage.objects;
create policy media_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists media_owner_update on storage.objects;
create policy media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists media_owner_delete on storage.objects;
create policy media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
