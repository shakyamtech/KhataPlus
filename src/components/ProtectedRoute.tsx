import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BookText } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#071324]" />
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  return <>{children}</>;
};
