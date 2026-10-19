# Supabase progress sync

## Setup

1. Create a Supabase project and enable Email/Password authentication. Configure email confirmation and password policy in Supabase Auth.
2. Apply `migrations/202610180001_user_progress_sync.sql` in the Supabase SQL editor or with the Supabase CLI.
3. Copy `.env.example` to `.env.local` and set the project URL and public anon/publishable key. Never put a service-role key in a `VITE_*` variable.
4. Restart Vite and use Föräldraläge > Molnsynk to create or sign in to the parent account. A first sync merges existing local records with that account: cloud rows win when the local row has no sync timestamp; local-only rows are uploaded. Subsequent conflicts use `updated_at` last-write-wins.

## Storage boundary

Supabase stores child profiles (including XP), child concept progress and introductions, learning-path progress, play-session history, achievements, and challenge progress. `introduced_concepts` is a security-invoker view over concept progress. Content packages, lessons, questions, discoveries, knowledge cards, generated challenge definitions, and parent PIN settings remain in IndexedDB and are not uploaded.

IndexedDB remains the runtime source for reads and writes. Dexie tracks local updates and a retryable outbox; background sync runs after writes, on reconnect, when the app becomes visible, and on demand. If credentials, network, or Supabase are unavailable, app behavior stays local. Deletes use owner-scoped tombstones so another device can apply them. A local owner binding prevents the same cache from being uploaded to a different parent account. All cloud tables enforce RLS against `auth.uid()`; the anon key is public and grants no access without a parent session.

## IndexedDB-only migration plan

1. Deploy the additive Supabase migration and configure Auth; do not clear or rename the existing `knowledge-portal` IndexedDB database.
2. Deploy the app with the cloud environment variables. On startup, any existing parent session is synced before default profiles are seeded.
3. On the first parent sign-in, merge the local cache with the account. Existing rows without timestamps are treated as legacy: matching cloud rows take precedence, and local rows missing in the cloud are uploaded. This avoids a second device's old seeded defaults overwriting already-synced progress.
4. Review profiles and progress on both devices. Keep the existing JSON export/import as a separate manual recovery path.
5. If Supabase is not configured, or sign-in/network is unavailable, keep using IndexedDB. The outbox retries when sync becomes available.

Sync merges XP, counters, discovery sets, session answers, and weekly challenge progress monotonically. Profile names and learning-path choices use last-write-wins timestamps. Device clock skew can affect those conflicts; server-authoritative revisions should be considered before supporting frequent simultaneous editing across devices.
