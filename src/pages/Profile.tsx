import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { isHeadAdmin } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Trophy, CheckCircle, Send, Calendar, Pencil, Save, X, Eye, EyeOff, Lock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [collegeName, setCollegeName] = useState("");
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [saving, setSaving] = useState(false);

  // Fallback stats from submissions
  const [fallbackTotal, setFallbackTotal] = useState<number | null>(null);
  const [fallbackCorrect, setFallbackCorrect] = useState<number | null>(null);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile?.college_id) {
      supabase.from("colleges").select("name").eq("id", profile.college_id).single().then(({ data }) => {
        if (data) setCollegeName(data.name);
      });
    }
    if (profile) {
      setFullName(profile.full_name);
      setRollNo(profile.roll_no || "");
    }
  }, [profile]);

  // Fallback: query submissions directly if profile stats are 0
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.total_submissions === 0) {
      supabase
        .from("submissions")
        .select("id, status")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setFallbackTotal(data.length);
            setFallbackCorrect(data.filter((s) => s.status === "correct").length);
          }
        });
    }
  }, [user, profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, roll_no: rollNo })
      .eq("user_id", profile.user_id);
    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated!");
      await refreshProfile();
      setEditing(false);
    }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const headAdmin = isHeadAdmin(profile?.email);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.user_id)
      .eq("role", "admin" as any)
      .then(({ data }: any) => {
        setIsAdmin(data && data.length > 0);
      });
  }, [profile]);

  if (!profile) return null;

  const showStats = !isAdmin || headAdmin;

  const totalSubs = fallbackTotal ?? profile.total_submissions;
  const correctSubs = fallbackCorrect ?? profile.correct_submissions;
  const score = fallbackCorrect ?? profile.score;

  const stats = [
    { icon: Send, label: "Total Submissions", value: totalSubs },
    { icon: CheckCircle, label: "Correct", value: correctSubs },
    { icon: Trophy, label: "Score", value: score },
  ];

  return (
    <div className="container max-w-2xl py-10 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Profile
          </CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-roll">Roll Number</Label>
                <Input id="edit-roll" value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={() => { setEditing(false); setFullName(profile.full_name); setRollNo(profile.roll_no || ""); }} className="gap-1.5">
                  <X className="h-4 w-4" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-2xl font-bold">{profile.full_name}</p>
              <p className="text-muted-foreground">{profile.email}</p>
              {profile.roll_no && (
                <p className="text-sm text-muted-foreground">Roll No: {profile.roll_no}</p>
              )}
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                🎓 {collegeName}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Joined {format(new Date(profile.created_at), "MMMM d, yyyy")}
              </p>
            </div>
          )}

          {showStats && (
            <div className="grid grid-cols-3 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border bg-muted/50 p-4 text-center">
                  <s.icon className="h-5 w-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pw">New Password</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm-pw"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button onClick={handlePasswordChange} disabled={changingPassword || !newPassword} className="gap-1.5">
            {changingPassword ? "Changing..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
