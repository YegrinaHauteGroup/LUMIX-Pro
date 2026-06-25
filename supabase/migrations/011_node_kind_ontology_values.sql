-- ============================================================
-- Migration 011: extend node_kind enum for the multi-dimensional SNA
-- ontology (spaces, skills, food/allergens, achievement domains,
-- ecosystem assets). Enum values MUST be added in their own migration
-- so later migrations can reference them in the same deploy.
-- ============================================================
alter type public.node_kind add value if not exists 'space';
alter type public.node_kind add value if not exists 'skill';
alter type public.node_kind add value if not exists 'food';
alter type public.node_kind add value if not exists 'achievement';
alter type public.node_kind add value if not exists 'ecosystem';
