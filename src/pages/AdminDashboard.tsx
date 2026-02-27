import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { isHeadAdmin } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileCheck, BarChart3, ShieldCheck, UserCheck, FolderKanban } from "lucide-react";
import AdminStats from "@/components/admin/AdminStats";
import AdminSubmissions from "@/components/admin/AdminSubmissions";
import AdminRequests from "@/components/admin/AdminRequests";
import AdminProjects from "@/components/admin/AdminProjects";

export default function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const headAdmin = isHeadAdmin(profile?.email);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => {
        setIsAdmin(data && data.length > 0);
      });
  }, [user, authLoading, navigate]);

  if (authLoading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container py-20 text-center">
        <ShieldCheck className="h-16 w-16 mx-auto text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have admin privileges to access this page.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="stats" className="space-y-6">
        <TabsList className={`grid w-full ${headAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Stats
          </TabsTrigger>
          <TabsTrigger value="submissions" className="gap-2">
            <FileCheck className="h-4 w-4" /> Submissions
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-2">
            <FolderKanban className="h-4 w-4" /> Projects
          </TabsTrigger>
          {headAdmin && (
            <TabsTrigger value="requests" className="gap-2">
              <UserCheck className="h-4 w-4" /> Requests
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="stats">
          <AdminStats />
        </TabsContent>
        <TabsContent value="submissions">
          <AdminSubmissions />
        </TabsContent>
        <TabsContent value="projects">
          <AdminProjects />
        </TabsContent>
        {headAdmin && (
          <TabsContent value="requests">
            <AdminRequests />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
