import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

// Gate for admin-only pages. ProtectedRoute only checks "is someone logged
// in" — this additionally checks golfer_profiles.role, since without it any
// signed-up user could reach the admin panel.
export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;

  const isAdmin = (profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin';
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};
