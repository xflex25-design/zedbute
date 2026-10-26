import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye } from "lucide-react";

const AdminPromotions = () => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      window.location.href = "/auth";
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
    setIsAdmin(!!data);
    if (data) loadPromotions();
  };

  const loadPromotions = async () => {
    const { data } = await supabase.from("promotions").select("*, music_releases(title, artist_name, cover_art_url), promotion_payments(*)").order("created_at", { ascending: false });
    setPromotions(data ?? []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("promotions").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Promotion marked as ${status}` });
      loadPromotions();
    }
  };

  useEffect(() => {
    checkAdmin();
  }, []);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 text-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" /></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 text-center text-muted-foreground">Access denied. Admins only.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-6xl">
        <h1 className="text-3xl font-bold mb-6">Manage Promotions</h1>
        <Card>
          <CardHeader>
            <CardTitle>All Promotion Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : promotions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No promotions yet</p>
            ) : (
              <Table>
<thead>
                   <TableRow>
                     <TableHead className="hidden sm:table-cell">Release</TableHead>
                     <TableHead>Amount</TableHead>
                     <TableHead className="hidden sm:table-cell">Payment</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="hidden sm:table-cell">Date</TableHead>
                     <TableHead>Actions</TableHead>
                   </TableRow>
                 </thead>
<TableBody>
                   {promotions.map((p) => (
                     <TableRow key={p.id}>
                       <TableCell className="sm:hidden">
                         <div className="flex items-center gap-2">
                           {p.music_releases?.cover_art_url ? (
                             <img src={p.music_releases.cover_art_url} alt={p.music_releases.title} className="w-8 h-8 rounded object-cover" />
                           ) : (
                             <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Eye className="h-4 w-4" /></div>
                           )}
                           <div>
                             <p className="text-sm font-medium">{p.music_releases?.title || "Unknown"}</p>
                             <p className="text-xs text-muted-foreground">{p.music_releases?.artist_name}</p>
                           </div>
                         </div>
                       </TableCell>
                       <TableCell className="hidden sm:table-cell">
                         <div className="flex items-center gap-2">
                           {p.music_releases?.cover_art_url ? (
                             <img src={p.music_releases.cover_art_url} alt={p.music_releases.title} className="w-8 h-8 rounded object-cover" />
                           ) : (
                             <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Eye className="h-4 w-4" /></div>
                           )}
                           <div>
                             <p className="text-sm font-medium">{p.music_releases?.title || "Unknown"}</p>
                             <p className="text-xs text-muted-foreground">{p.music_releases?.artist_name}</p>
                           </div>
                         </div>
                       </TableCell>
                       <TableCell className="text-sm font-medium">K{p.amount.toFixed(2)}</TableCell>
                       <TableCell className="hidden sm:table-cell">
                         {p.promotion_payments?.length > 0 ? (
                           <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">Paid</Badge>
                         ) : (
                           <Badge variant="outline">No payment</Badge>
                         )}
                       </TableCell>
                       <TableCell>
                         <Badge className={
                           p.status === "active" ? "bg-green-500/15 text-green-600 border-green-500/30" :
                             p.status === "paid" ? "bg-blue-500/15 text-blue-600 border-blue-500/30" :
                               p.status === "pending" ? "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" :
                                 p.status === "rejected" ? "bg-red-500/15 text-red-600 border-red-500/30" :
                                   "bg-gray-500/15 text-gray-600 border-gray-500/30"
                         }>{p.status}</Badge>
                       </TableCell>
                       <TableCell className="hidden sm:table-cell text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                       <TableCell>
                         <div className="flex flex-col xs:flex-row gap-1 xs:gap-2">
                           {p.status === "pending" && (
                             <>
                               <Button size="sm" onClick={() => updateStatus(p.id, "active")} className="h-7 xs:h-8 px-1.5 xs:px-2 text-[10px] xs:text-xs bg-green-500 hover:bg-green-600 text-white">
                                 <CheckCircle className="h-2.5 w-2.5 xs:h-3 xs:w-3 mr-0.5 xs:mr-1" /> Approve
                               </Button>
                               <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, "rejected")} className="h-7 xs:h-8 px-1.5 xs:px-2 text-[10px] xs:text-xs">
                                 <XCircle className="h-2.5 w-2.5 xs:h-3 xs:w-3 mr-0.5 xs:mr-1" /> Reject
                               </Button>
                             </>
                           )}
                           {p.status === "active" && (
                             <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, "expired")} className="h-7 xs:h-8 px-1.5 xs:px-2 text-[10px] xs:text-xs">
                               Mark Expired
                             </Button>
                           )}
                         </div>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPromotions;
