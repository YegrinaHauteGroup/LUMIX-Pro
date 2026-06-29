# Migrations

Forward-only, timestamp-ordered SQL migrations applied via the Supabase CLI /
MCP. Each file is idempotent where practical (`IF NOT EXISTS`, guarded `DO`
blocks) so re-running is safe.

## Rollback policy (M9)

Supabase migrations are forward-only by default — there is no automatic `down`
runner. To make rollback tractable:

- New migrations from 023 onward include a commented **`-- rollback`** section
  at the end with the inverse statements. To revert, run that block manually.
- Schema-destructive changes (dropping columns/tables) are avoided in favor of
  additive changes plus a later cleanup migration, so most migrations can be
  reverted by dropping the objects they created.
- Before reverting a function/trigger replacement, restore the prior body from
  the migration that previously defined it (referenced in the rollback note).

## Note on `get_sna_graph` history (M8)

`get_sna_graph` was iterated across migrations 003 → 004 → 010 → 012 as the SNA
model evolved (single-kind → multi-kind → labeled/valenced edges). Those files
are retained as the historical record (re-running them in order reproduces the
current definition). The **current** definition is the one installed by the
latest migration that touches it; earlier `CREATE OR REPLACE` statements are
superseded and exist only for ordered replay. A future consolidation migration
can `CREATE OR REPLACE` the final definition in one place and mark the
intermediate ones obsolete, but rewriting historical migrations is avoided so
existing environments replay identically.
