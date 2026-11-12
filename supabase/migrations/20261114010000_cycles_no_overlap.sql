-- Cycles cannot overlap (T122), so `cycle_for` never matches two. A range exclusion needs no
-- extension: gist indexes date ranges natively. Inclusive bounds, as `cycle_for` uses between.
-- `prepare_next_cycle`'s `on conflict do nothing` also absorbs this, so an overlapping next
-- cycle is skipped silently rather than failing the daily close.
alter table public.cycles
  add constraint cycles_no_overlap exclude using gist (daterange(start_date, end_date, '[]') with &&);
