import { useTypedSelector } from "@/app/hook";
import { Navigate, Outlet } from "react-router-dom";
import { AUTH_ROUTES } from "./common/routePath";

const ProtectedRoute = () => {
  const { user } = useTypedSelector((state) => state.auth);

  if (user) return <Outlet />;

  return <Navigate to={AUTH_ROUTES.SIGN_IN} replace />;
};

export default ProtectedRoute;
