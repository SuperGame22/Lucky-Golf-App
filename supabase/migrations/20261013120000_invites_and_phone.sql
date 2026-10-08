-- Wager invite links and phone numbers.
--
--   * player_contacts: a player's mobile number (US, stored as +1XXXXXXXXXX) with the time they
--     agreed to be texted, and who invited them (first invite wins). Players can read their own
--     row; writes go only through set_my_phone() and accept_wager_invite().
--   * wager_invites: one row each time someone opens an invite link and joins that wager, so
--     signups and joins can be traced back to who invited them.
--
-- The invite text itself is sent from the host's own phone, so nothing here sends a message.
--
-- To roll back: DROP FUNCTION public.set_my_phone(text, boolean); DROP FUNCTION public.accept_wager_invite(text, uuid);
--   DROP FUNCTION public.get_my_contact(); DROP TABLE public.wager_invites; DROP TABLE public.player_contacts;

DO $$
BEGIN
  IF to_regclass('public.golfer_profiles') IS NULL THEN
    RAISE EXCEPTION 'Invites and phone: public.golfer_profiles not found';
  END IF;
END $$;

CREATE TABLE public.player_contacts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT CHECK (phone ~ '^\+1[2-9][0-9]{9}$'),
  phone_consent_at TIMESTAMP WITH TIME ZONE,
  referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- a stored number always comes with the consent it was given under
  CONSTRAINT phone_needs_consent CHECK (phone IS NULL OR phone_consent_at IS NOT NULL)
);

CREATE TABLE public.wager_invites (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL CHECK (code ~ '^[A-Z0-9]{6}$'),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (code, invitee_id),
  CHECK (inviter_id <> invitee_id)
);

CREATE INDEX wager_invites_inviter_idx ON public.wager_invites (inviter_id, created_at DESC);

ALTER TABLE public.player_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wager_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own contact details" ON public.player_contacts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Players can view invites they sent or accepted" ON public.wager_invites FOR SELECT TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.player_contacts, public.wager_invites FROM anon, authenticated;
REVOKE USAGE, SELECT, UPDATE ON SEQUENCE public.wager_invites_id_seq FROM anon, authenticated;

-- Save my mobile number. Needs a US number and a yes to being texted.
CREATE OR REPLACE FUNCTION public.set_my_phone(p_phone TEXT, p_consent BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_digits TEXT;
  v_phone TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_consent IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Consent to be texted is required to save a number');
  END IF;

  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  IF length(v_digits) = 11 AND left(v_digits, 1) = '1' THEN
    v_digits := substr(v_digits, 2);
  END IF;
  v_phone := '+1' || v_digits;
  IF v_phone !~ '^\+1[2-9][0-9]{9}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a 10-digit US mobile number');
  END IF;

  INSERT INTO public.player_contacts (user_id, phone, phone_consent_at)
  VALUES (v_uid, v_phone, now())
  ON CONFLICT (user_id) DO UPDATE
    SET phone = EXCLUDED.phone,
        phone_consent_at = CASE WHEN public.player_contacts.phone IS DISTINCT FROM EXCLUDED.phone THEN now() ELSE public.player_contacts.phone_consent_at END,
        updated_at = now();

  RETURN jsonb_build_object('success', true, 'phone', v_phone);
END;
$$;

-- I opened an invite link and joined this wager: remember who invited me.
CREATE OR REPLACE FUNCTION public.accept_wager_invite(p_code TEXT, p_inviter UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := upper(coalesce(p_code, ''));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite code');
  END IF;
  IF p_inviter IS NULL OR p_inviter = v_uid OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_inviter) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid inviter');
  END IF;

  INSERT INTO public.wager_invites (code, inviter_id, invitee_id)
  VALUES (v_code, p_inviter, v_uid)
  ON CONFLICT (code, invitee_id) DO NOTHING;

  -- The first person to invite me is remembered.
  INSERT INTO public.player_contacts (user_id, referred_by)
  VALUES (v_uid, p_inviter)
  ON CONFLICT (user_id) DO UPDATE
    SET referred_by = coalesce(public.player_contacts.referred_by, EXCLUDED.referred_by), updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Do I have a number saved yet? (never returns the number itself)
CREATE OR REPLACE FUNCTION public.get_my_contact()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.player_contacts;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO c FROM public.player_contacts WHERE user_id = auth.uid();
  RETURN jsonb_build_object('success', true, 'has_phone', coalesce(c.phone IS NOT NULL, false), 'invited', coalesce(c.referred_by IS NOT NULL, false));
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_phone(TEXT, BOOLEAN), public.accept_wager_invite(TEXT, UUID), public.get_my_contact() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_phone(TEXT, BOOLEAN), public.accept_wager_invite(TEXT, UUID), public.get_my_contact() TO authenticated;
