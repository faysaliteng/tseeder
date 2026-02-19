import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Root index — immediately redirects to the user dashboard.
 * Route-level redirect is also defined in App.tsx; this component
 * acts as a fallback in case the Navigate element is bypassed.
 */
const Index = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate("/app/dashboard", { replace: true }); }, [navigate]);
  return null;
};

export default Index;
