// routes/RequireRole.tsx
import { Navigate } from "react-router-dom";

type RequireRoleProps = {
  role: string | string[];
  children: any;
};

export default function RequireRole({ role, children }: RequireRoleProps) {
  const currentRole = localStorage.getItem("role");
  if (!currentRole) return <Navigate to="/login" replace />;
  if (Array.isArray(role)) {
    if (!role.includes(currentRole)) return <Navigate to="/" replace />;
    return children;
  }
  if (currentRole !== role) return <Navigate to="/" replace />;
  return children;
}
