import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Music2 } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-primary flex items-center justify-center">
            <Music2 className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>
        <h1 className="mb-3 text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">Oops! This page doesn't exist.</p>
        <Button asChild variant="hero" size="lg">
          <Link to="/">Return Home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
