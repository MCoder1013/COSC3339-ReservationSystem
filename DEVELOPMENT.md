## Initial setup

```sh
cd backend
npm install
# in a separate tab
cd frontend
npm install
```

## Development

```sh
cd backend
npm run dev
# in a separate tab
cd frontend
npm run dev
```

## Database schema migrations

This exists to make database updates be applied to everyone automatically. Each update to the database is represented as a separate "migration".

To create a migration, run the following commands (replacing MIGRATION_NAME with a short description):

```sh
cd backend
npx db-migrate create MIGRATION_NAME
```

Then, edit the new file that got created in `backend/migrations/sqls/` with your migration name and that ends in `-up.sql`.

The `up` file is the one that gets run automatically and is where you should put your SQL that updates the database.
Editing the `down` migration is optional, that's just used if you want to allow a database update to be undone.

To manually run a migration (which is usually unnecessary), run `npx db-migrate up`.
To undo the last migration (if the `down.sql` is implemented), use `npx db-migrate down`.

You shouldn't edit old migrations since those won't be applied automatically, just create a new one instead.
