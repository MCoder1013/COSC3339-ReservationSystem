update users
set user_role = 'admin'
where id in (
    select staff_id from staff where role = 'admin'
);
