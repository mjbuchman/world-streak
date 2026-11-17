begin;
select plan(2);

-- The pool replaced the rotation (T150); T162 drops the old setting. The pool's own checks are in
-- lineups.test.sql and game_settings.test.sql.
select hasnt_column('public', 'game_settings', 'rotation', 'the rotation setting is gone');
select hasnt_function('public', 'check_rotation', 'and so is its check');

select * from finish();
rollback;
