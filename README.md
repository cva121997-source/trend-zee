# TREND ZEE

Vercel-compatible commerce storefront and admin dashboard backed by Supabase.

## Vercel environment variables

Set these in Vercel Project Settings → Environment Variables:

- SUPABASE_URL
- SUPABASE_SECRET_KEY
- ADMIN_PASSWORD_HASH
- ADMIN_SESSION_SECRET

Use the Supabase publishable/anon key only for browser-side Supabase clients. This application uses server-side API routes, so the database and Storage operations use the server-only secret key.

## Supabase

The database schema is in `supabase-migration.sql`. It creates the `products` and `records` tables and enables RLS.

The application creates the public `product-images` Storage bucket on first admin upload when it does not already exist.

## Build

`npm install`

`npm run build`

`npm start`
