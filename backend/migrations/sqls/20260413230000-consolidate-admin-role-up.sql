UPDATE users u
SET user_role = 'admin'
FROM staff s
WHERE s.staff_id = u.id
  AND lower(s.role) = 'admin'
  AND u.user_role <> 'admin';
