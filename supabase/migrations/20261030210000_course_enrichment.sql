-- Course enrichment: per-hole hazards, hole geometry, elevation and plain-English tips, derived from
-- OpenStreetMap (ODbL) geometry and USGS 3DEP elevation (public domain). Planned Clover Club perk.
--   * Kept in its own table so the scorecard data in public.courses is never touched by the enrichment job.
--   * RLS is ON with no policies, and anon/authenticated have no grants: only the service role can read it
--     for now. A Clover Club / Gold read policy is added later, once the membership check is signed off.
--   * Rows are written by the offline batch job (service role). Deleting a course deletes its enrichment.
-- To roll back: DROP TABLE public.course_enrichment;

DO $$
BEGIN
  IF to_regclass('public.courses') IS NULL THEN RAISE EXCEPTION 'Course enrichment migration: courses table not found'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.course_enrichment (
  course_id BIGINT PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
  -- [{hole, length_m, elevation_tee_m, elevation_green_m, elevation_change_m, dogleg: none|left|right,
  --   hazards: [{type: bunker|water|lateral_water|out_of_bounds|trees, side: left|right|front|back|crossing,
  --              distance_from_tee_m}], tip}]
  holes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(holes) = 'array'),
  course_summary TEXT,
  elevation_min_m DOUBLE PRECISION,
  elevation_max_m DOUBLE PRECISION,
  sources JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method_version TEXT NOT NULL
);

COMMENT ON TABLE public.course_enrichment IS
  'Per-hole hazards, geometry, elevation and tips (OSM ODbL + USGS 3DEP). Service-role only until a Clover Club read policy is approved.';

ALTER TABLE public.course_enrichment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_enrichment FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.course_enrichment TO service_role;
