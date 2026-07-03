import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider}  from 'react-helmet-async';
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Verify from "./pages/Verify";
import VerifyClaim from "./pages/VerifyClaim";
import Admin from "./pages/Admin";
import UploadRelease from "./pages/UploadRelease";
import UploadEP from "./pages/UploadEP";
import UploadAlbum from "./pages/UploadAlbum";
import Pricing from "./pages/Pricing";
import ReleaseSuccess from "./pages/ReleaseSuccess";
import Payment from "./pages/Payment";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Royalties from "./pages/Royalties";
import AdminPromotions from "./pages/AdminPromotions";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
              <Route path="/verify-claim" element={<VerifyClaim />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/promotions" element={<AdminPromotions />} />
              <Route path="/upload-release" element={<UploadRelease />} />
              <Route path="/upload-ep" element={<UploadEP />} />
              <Route path="/upload-album" element={<UploadAlbum />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/release-success" element={<ReleaseSuccess />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/royalties" element={<Royalties />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
