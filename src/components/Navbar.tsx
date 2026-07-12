import { Music2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const linkClass = (isActive: boolean) =>
  cn(
    "text-sm font-medium px-3 py-2 rounded-md transition-all duration-200",
    isActive
      ? "text-primary bg-primary/10"
      : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
  );

const mobileLinkClass = (isActive: boolean) =>
  cn(
    "flex items-center text-sm font-medium rounded-md transition-all duration-200 py-3 px-4 min-h-[44px]",
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
    toast({ title: "Signed out successfully" });
  };

  const closeMobile = () => setMobileMenuOpen(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0" onClick={closeMobile}>
            <Music2 className="h-8 w-8 text-primary shrink-0" />
            <span className="text-xl font-bold whitespace-nowrap">
              <span className="text-green-500">zed</span>
              <span className="text-red-500">B</span>
              <span className="text-foreground">ute</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/" className={linkClass(location.pathname === "/")}>Home</Link>
            {user && (
              <>
                <Link to="/dashboard" className={linkClass(location.pathname === "/dashboard")}>Dashboard</Link>
                <Link to="/upload-release" className={linkClass(location.pathname === "/upload-release")}>Upload Release</Link>
                <Link to="/verify" className={linkClass(location.pathname === "/verify")}>Get Verified</Link>
                <Link to="/spotify-claim" className={linkClass(location.pathname === "/spotify-claim")}>Claim Spotify</Link>
                <Link to="/boomplay-claim" className={linkClass(location.pathname === "/boomplay-claim")}>Claim Boomplay</Link>
                <Link to="/settings" className={linkClass(location.pathname === "/settings")}>Settings</Link>
              </>
            )}
            <Link to="/pricing" className={linkClass(location.pathname === "/pricing")}>Pricing</Link>
            <Link to="/blog" className={linkClass(location.pathname === "/blog")}>Blog</Link>
            <ThemeToggle />
            {user ? (
              <Button onClick={handleSignOut} variant="outline" size="sm">Sign Out</Button>
            ) : (
              <div className="flex gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Login</Button>
                <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>Get Started</Button>
              </div>
            )}
          </div>

          {/* Mobile Auth Button + Hamburger Toggle */}
          <div className="md:hidden flex items-center gap-2">
            {user ? (
              <Button onClick={handleSignOut} variant="outline" size="sm" className="h-9">Sign Out</Button>
            ) : (
              <Button variant="hero" size="sm" className="h-9" onClick={() => navigate("/auth")}>Login</Button>
            )}
            <button
              className="flex items-center justify-center h-11 w-11 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Slide-down Panel */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 ease-out",
          mobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="container mx-auto px-4 pb-4 space-y-1 border-t border-border pt-2">
          <Link to="/" className={mobileLinkClass(location.pathname === "/")} onClick={closeMobile}>Home</Link>
          {user && (
            <>
              <Link to="/dashboard" className={mobileLinkClass(location.pathname === "/dashboard")} onClick={closeMobile}>Dashboard</Link>
              <Link to="/upload-release" className={mobileLinkClass(location.pathname === "/upload-release")} onClick={closeMobile}>Upload Release</Link>
              <Link to="/verify" className={mobileLinkClass(location.pathname === "/verify")} onClick={closeMobile}>Get Verified</Link>
              <Link to="/spotify-claim" className={mobileLinkClass(location.pathname === "/spotify-claim")} onClick={closeMobile}>Claim Spotify</Link>
              <Link to="/boomplay-claim" className={mobileLinkClass(location.pathname === "/boomplay-claim")} onClick={closeMobile}>Claim Boomplay</Link>
              <Link to="/settings" className={mobileLinkClass(location.pathname === "/settings")} onClick={closeMobile}>Settings</Link>
            </>
          )}
          <Link to="/pricing" className={mobileLinkClass(location.pathname === "/pricing")} onClick={closeMobile}>Pricing</Link>
          <Link to="/blog" className={mobileLinkClass(location.pathname === "/blog")} onClick={closeMobile}>Blog</Link>
          <div className="pt-2 space-y-2">
            <div className="px-4">
              <ThemeToggle />
            </div>
            {user ? (
              <Button onClick={handleSignOut} variant="outline" size="sm" className="w-full h-11">Sign Out</Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button variant="ghost" size="sm" onClick={() => { navigate("/auth"); closeMobile(); }} className="w-full h-11">Login</Button>
                <Button variant="hero" size="sm" onClick={() => { navigate("/auth"); closeMobile(); }} className="w-full h-11">Get Started</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
