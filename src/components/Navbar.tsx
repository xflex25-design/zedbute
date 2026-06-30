import { Music2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const navLinkClass = (isActive: boolean) =>
  cn(
    "text-sm font-medium px-3 py-2 rounded-md transition-all duration-200",
    isActive
      ? "text-primary bg-primary/10"
      : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
  );

const mobileNavLinkClass = (isActive: boolean) =>
  cn(
    "block text-sm font-medium rounded-md transition-all duration-200 py-2.5 px-3",
    isActive
      ? "text-primary bg-primary/10"
      : "text-foreground hover:text-primary hover:bg-muted/50"
  );

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    toast({
      title: "Signed out successfully",
    });
  };

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Music2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">
              <span className="text-green-500">zed</span>
              <span className="text-red-500">B</span>
              <span className="text-foreground">ute</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/" className={navLinkClass(location.pathname === "/")}>Home</Link>
            {user && (
              <>
                <Link to="/dashboard" className={navLinkClass(location.pathname === "/dashboard")}>Dashboard</Link>
                <Link to="/upload-release" className={navLinkClass(location.pathname === "/upload-release")}>Upload Release</Link>
                <Link to="/verify" className={navLinkClass(location.pathname === "/verify")}>Get Verified</Link>
              </>
            )}
            <Link to="/pricing" className={navLinkClass(location.pathname === "/pricing")}>Pricing</Link>
            <Link to="/blog" className={navLinkClass(location.pathname === "/blog")}>Blog</Link>
            
            {user ? (
              <Button onClick={handleSignOut} variant="outline" size="sm">
                Sign Out
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                  Login
                </Button>
                <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>
                  Get Started
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
            mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="py-4 space-y-1 border-t border-border">
            <Link to="/" className={mobileNavLinkClass(location.pathname === "/")} onClick={closeMobile}>Home</Link>
            {user && (
              <>
                <Link to="/dashboard" className={mobileNavLinkClass(location.pathname === "/dashboard")} onClick={closeMobile}>Dashboard</Link>
                <Link to="/upload-release" className={mobileNavLinkClass(location.pathname === "/upload-release")} onClick={closeMobile}>Upload Release</Link>
                <Link to="/verify" className={mobileNavLinkClass(location.pathname === "/verify")} onClick={closeMobile}>Get Verified</Link>
              </>
            )}
            <Link to="/pricing" className={mobileNavLinkClass(location.pathname === "/pricing")} onClick={closeMobile}>Pricing</Link>
            <Link to="/blog" className={mobileNavLinkClass(location.pathname === "/blog")} onClick={closeMobile}>Blog</Link>
            <div className="pt-2 px-1">
              {user ? (
                <Button onClick={handleSignOut} variant="outline" size="sm" className="w-full">
                  Sign Out
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="w-full">
                    Login
                  </Button>
                  <Button variant="hero" size="sm" onClick={() => navigate("/auth")} className="w-full">
                    Get Started
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
