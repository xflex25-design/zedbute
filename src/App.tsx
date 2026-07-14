import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider}  from 'react-helmet-async';
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Verify from "./pages/Verify";
import Admin from "./pages/Admin";
import SpotifyClaim from "./pages/SpotifyClaim";
import BoomplayClaim from "./pages/BoomplayClaim";
import AdminSpotifyClaims from "./pages/AdminSpotifyClaims";
import MyPlaylists from "./pages/MyPlaylists";
import PlaylistSubmit from "./pages/PlaylistSubmit";
import AdminPlaylistSubmissions from "./pages/AdminPlaylistSubmissions";
import AdminPlaylists from "./pages/AdminPlaylists";
import UploadRelease from "./pages/UploadRelease";
import UploadEP from "./pages/UploadEP";
import UploadAlbum from "./pages/UploadAlbum";
import Pricing from "./pages/Pricing";
import ReleaseSuccess from "./pages/ReleaseSuccess";
import Payment from "./pages/Payment";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Royalties from "./pages/Royalties";
import DashboardRoyalties from "./pages/DashboardRoyalties";
import AdminPayouts from "./pages/AdminPayouts";
import AdminPromotions from "./pages/AdminPromotions";
import Settings from "./pages/Settings";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <HelmetProvider context={{}}>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/verify" element={<Verify />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/spotify-claims" element={<AdminSpotifyClaims />} />
                <Route path="/playlists" element={<MyPlaylists />} />
                <Route path="/submit-to-playlist" element={<PlaylistSubmit />} />
                <Route path="/admin/playlist-submissions" element={<AdminPlaylistSubmissions />} />
                <Route path="/admin/playlists" element={<AdminPlaylists />} />
                <Route path="/spotify-claim" element={<SpotifyClaim />} />
                <Route path="/boomplay-claim" element={<BoomplayClaim />} />
                <Route path="/admin/promotions" element={<AdminPromotions />} />
                <Route path="/upload-release" element={<UploadRelease />} />
                <Route path="/upload-ep" element={<UploadEP />} />
                <Route path="/upload-album" element={<UploadAlbum />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/release-success" element={<ReleaseSuccess />} />
                <Route path="/payment" element={<Payment />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/dashboard/royalties" element={<DashboardRoyalties />} />
                <Route path="/admin/payouts" element={<AdminPayouts />} />
                <Route path="/royalties" element={<Royalties />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </HelmetProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
