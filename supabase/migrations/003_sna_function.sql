-- ============================================================
-- LUMIX Pro - Migration 003: SNA graph function
-- ============================================================

CREATE OR REPLACE FUNCTION get_sna_graph(p_center_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH active_children AS (
    SELECT id, name, class_id
    FROM children
    WHERE center_id = p_center_id
      AND status = 'active'
  ),
  classmate_counts AS (
    SELECT
      c1.id AS child_id,
      COUNT(c2.id) AS classmates
    FROM active_children c1
    LEFT JOIN active_children c2
      ON c2.class_id = c1.class_id
     AND c2.id != c1.id
    GROUP BY c1.id
  ),
  activity_counts AS (
    SELECT
      c.id AS child_id,
      COUNT(a.id) AS activity_connections
    FROM active_children c
    LEFT JOIN activities a
      ON a.class_id = c.class_id
     AND a.center_id = p_center_id
    GROUP BY c.id
  ),
  nodes AS (
    SELECT
      ac.id                                                               AS child_id,
      ac.name,
      ac.class_id,
      COALESCE(cc.classmates, 0) + COALESCE(apc.activity_connections, 0) AS connection_count
    FROM active_children ac
    LEFT JOIN classmate_counts cc  ON cc.child_id  = ac.id
    LEFT JOIN activity_counts  apc ON apc.child_id = ac.id
  ),
  pairs AS (
    SELECT DISTINCT
      LEAST(c1.id::text, c2.id::text)    AS source_id,
      GREATEST(c1.id::text, c2.id::text) AS target_id,
      c1.class_id
    FROM active_children c1
    JOIN active_children c2
      ON c2.class_id = c1.class_id
     AND c2.id != c1.id
  ),
  edges AS (
    SELECT
      p.source_id,
      p.target_id,
      COUNT(a.id) + 1 AS strength
    FROM pairs p
    LEFT JOIN activities a
      ON a.class_id  = p.class_id
     AND a.center_id = p_center_id
    GROUP BY p.source_id, p.target_id
  )
  SELECT jsonb_build_object(
    'nodes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'child_id',        child_id,
        'name',            name,
        'class_id',        class_id,
        'connection_count', connection_count
      ))
      FROM nodes
    ), '[]'::jsonb),
    'edges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'source_id', source_id,
        'target_id', target_id,
        'strength',  strength
      ))
      FROM edges
    ), '[]'::jsonb)
  );
$$;
