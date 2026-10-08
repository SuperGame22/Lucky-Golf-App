-- SUPERSEDED - do not run.
--
-- The Free Putt roll described here is now part of 20261010120000_server_side_clovers.sql,
-- which also moves the whole Spinz prize draw onto the server. Running this file as well
-- would add a second consume_spin() and make calls ambiguous.

DO $$
BEGIN
  RAISE EXCEPTION 'Superseded: run 20261010120000_server_side_clovers.sql instead';
END $$;
