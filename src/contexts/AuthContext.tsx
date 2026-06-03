import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const AuthContext = createContext<any>(undefined); 
export const AuthProvider = ({ children }: { children: React.ReactNode }) => { 
  const [user, setUser] = useState(any); 
  const [profile, setProfile] = useState(any);
  const [loading, setLoading_ = useState(true);
  return <AuthContext.Provider value={{user, profile, loading, signOut: () => supabase.auth.signOut(), refreshProfile: () => {} }}>{children}</AuthContext.Provider>; 
};
export const useAuth = () => useContext(AuthContext);
