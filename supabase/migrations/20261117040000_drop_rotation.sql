-- The pool replaced the rotation (T150); nothing reads it since the lineups (T151). T162 drops it.
drop trigger game_settings_check_rotation on public.game_settings;
drop function public.check_rotation();
alter table public.game_settings drop column rotation;
