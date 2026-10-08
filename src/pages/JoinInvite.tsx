import { useEffect } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { parseInviteCode, savePendingInvite } from "@/features/invites/invites";

/**
 * The page an invite text opens: /join/ABC123?from=<host>. The invite is remembered, then the
 * visitor goes to the wager (if signed in) or to sign up first and lands in the wager afterwards.
 */
export default function JoinInvite() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const valid = parseInviteCode(code);

  useEffect(() => {
    if (valid) savePendingInvite(localStorage, valid, params.get("from"));
  }, [valid, params]);

  if (!valid) return <Navigate to="/" replace />;
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  return user ? <Navigate to="/play/wagers" replace /> : <Navigate to="/auth?invite=1" replace />;
}
