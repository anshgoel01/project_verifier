import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderKanban, Save, Trophy } from "lucide-react";
import { toast } from "sonner";

type Project = {
  id: string;
  name: string;
  coursera_level: string;
  weight: number;
  submission_count: number;
};

type LevelDefault = {
  level: string;
  default_weight: number;
};

type LeaderboardEntry = {
  user_id: string;
  full_name: string;
  college_name: string;
  weighted_score: number;
};

export default function AdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [levelDefaults, setLevelDefaults] = useState<LevelDefault[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [editedWeights, setEditedWeights] = useState<Record<string, number>>({});
  const [editedDefaults, setEditedDefaults] = useState<Record<string, number>>({});

  const autoPopulateProjects = async () => {
    // Get all unique correct course names from submissions
    const { data: subs } = await supabase
      .from("submissions")
      .select("coursera_course")
      .eq("status", "correct")
      .not("coursera_course", "is", null);

    const uniqueCourses = [...new Set((subs || []).map((s) => s.coursera_course).filter(Boolean))] as string[];
    if (uniqueCourses.length === 0) return;

    // Get existing project names
    const { data: existing } = await supabase
      .from("projects")
      .select("name");

    const existingNames = new Set((existing || []).map((p) => p.name));
    const newCourses = uniqueCourses.filter((c) => !existingNames.has(c));

    if (newCourses.length === 0) return;

    // Get level defaults for beginner (default level for new projects)
    const { data: defaults } = await supabase
      .from("project_level_defaults")
      .select("*");

    const beginnerWeight = defaults?.find((d) => d.level === "beginner")?.default_weight || 0.3;

    // Insert new projects
    const inserts = newCourses.map((name) => ({
      name,
      coursera_level: "beginner",
      weight: beginnerWeight,
    }));

    const { error } = await supabase.from("projects").insert(inserts);
    if (error) {
      console.error("Auto-populate error:", error);
    }
  };

  const fetchAll = async () => {
    setLoading(true);

    // Auto-populate first
    await autoPopulateProjects();

    // Fetch projects
    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .order("coursera_level")
      .order("name");

    // Fetch submission counts per course
    const { data: submissions } = await supabase
      .from("submissions")
      .select("coursera_course, user_id")
      .eq("status", "correct");

    const courseCounts: Record<string, number> = {};
    (submissions || []).forEach((s: any) => {
      if (s.coursera_course) {
        courseCounts[s.coursera_course] = (courseCounts[s.coursera_course] || 0) + 1;
      }
    });

    const projectsList = (projectsData || []).map((p) => ({
      ...p,
      submission_count: courseCounts[p.name] || 0,
    }));

    setProjects(projectsList);

    // Fetch level defaults
    const { data: defaults } = await supabase
      .from("project_level_defaults")
      .select("*");
    setLevelDefaults(defaults || []);

    // Calculate leaderboard
    await calculateLeaderboard(projectsList, submissions || []);

    setLoading(false);
  };

  const calculateLeaderboard = async (projectsList: Project[], submissions: any[]) => {
    const weightMap: Record<string, number> = {};
    projectsList.forEach((p) => { weightMap[p.name] = p.weight; });

    const userScores: Record<string, { score: number; user_id: string }> = {};
    submissions.forEach((s: any) => {
      if (s.coursera_course && weightMap[s.coursera_course] !== undefined) {
        if (!userScores[s.user_id]) {
          userScores[s.user_id] = { score: 0, user_id: s.user_id };
        }
        userScores[s.user_id].score += weightMap[s.coursera_course];
      }
    });

    const userIds = Object.keys(userScores);
    if (userIds.length === 0) {
      setLeaderboard([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, college_id, colleges(name)")
      .in("user_id", userIds);

    const entries: LeaderboardEntry[] = (profiles || [])
      .map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        college_name: p.colleges?.name || "Unknown",
        weighted_score: Math.round((userScores[p.user_id]?.score || 0) * 10) / 10,
      }))
      .sort((a, b) => b.weighted_score - a.weighted_score);

    setLeaderboard(entries);
  };

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("projects-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        fetchAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_level_defaults" }, () => {
        fetchAll();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleWeightChange = (projectId: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0.1 && num <= 1.0) {
      setEditedWeights((prev) => ({ ...prev, [projectId]: Math.round(num * 10) / 10 }));
    }
  };

  const handleSaveWeight = async (project: Project) => {
    const newWeight = editedWeights[project.id];
    if (newWeight === undefined || newWeight === project.weight) return;

    setSavingId(project.id);
    const { error } = await supabase
      .from("projects")
      .update({ weight: newWeight })
      .eq("id", project.id);

    if (error) {
      toast.error("Failed to update weight");
    } else {
      toast.success(`Weight updated for ${project.name}`);
      setEditedWeights((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
    }
    setSavingId(null);
  };

  const handleLevelChange = async (projectId: string, newLevel: string) => {
    const defaultWeight = levelDefaults.find((d) => d.level === newLevel)?.default_weight || 0.5;
    const { error } = await supabase
      .from("projects")
      .update({ coursera_level: newLevel, weight: defaultWeight })
      .eq("id", projectId);

    if (error) {
      toast.error("Failed to update level");
    } else {
      toast.success("Level updated");
    }
  };

  const handleDefaultChange = (level: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0.1 && num <= 1.0) {
      setEditedDefaults((prev) => ({ ...prev, [level]: Math.round(num * 10) / 10 }));
    }
  };

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    for (const [level, weight] of Object.entries(editedDefaults)) {
      await supabase
        .from("project_level_defaults")
        .update({ default_weight: weight })
        .eq("level", level);

      await supabase
        .from("projects")
        .update({ weight })
        .eq("coursera_level", level);
    }
    toast.success("Level defaults updated and applied");
    setEditedDefaults({});
    setSavingDefaults(false);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Level Default Weights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderKanban className="h-5 w-5 text-primary" /> Default Weights by Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {levelDefaults.map((d) => (
              <div key={d.level} className="space-y-1">
                <label className="text-sm font-medium capitalize">{d.level}</label>
                <Input
                  type="number"
                  min={0.1}
                  max={1.0}
                  step={0.1}
                  className="w-24"
                  value={editedDefaults[d.level] ?? d.default_weight}
                  onChange={(e) => handleDefaultChange(d.level, e.target.value)}
                />
              </div>
            ))}
            <Button
              onClick={handleSaveDefaults}
              disabled={savingDefaults || Object.keys(editedDefaults).length === 0}
              size="sm"
              className="gap-2"
            >
              {savingDefaults ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Apply Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderKanban className="h-5 w-5 text-primary" /> All Projects ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No projects found. Projects will auto-populate from verified submissions.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-center">Submissions</TableHead>
                    <TableHead className="w-32">Weight</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium max-w-xs truncate">{p.name}</TableCell>
                      <TableCell>
                        <Select
                          value={p.coursera_level}
                          onValueChange={(v) => handleLevelChange(p.id, v)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">{p.submission_count}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0.1}
                          max={1.0}
                          step={0.1}
                          className="w-20"
                          value={editedWeights[p.id] ?? p.weight}
                          onChange={(e) => handleWeightChange(p.id, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveWeight(p)}
                          disabled={savingId === p.id || editedWeights[p.id] === undefined}
                        >
                          {savingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-primary" /> Project Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No scores yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>College</TableHead>
                    <TableHead className="text-center">Weighted Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((e, i) => (
                    <TableRow key={e.user_id}>
                      <TableCell className="text-center font-mono">{i + 1}</TableCell>
                      <TableCell className="font-medium">{e.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{e.college_name}</TableCell>
                      <TableCell className="text-center font-bold text-primary">{e.weighted_score}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
