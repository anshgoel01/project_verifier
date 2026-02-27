import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, FileCheck, CheckCircle, XCircle, BarChart3, Clock } from "lucide-react";

type CollegePerf = { name: string; students: number; correct: number; total: number; score: number };

export default function AdminStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);
  const [collegePerformance, setCollegePerformance] = useState<CollegePerf[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, college_id, total_submissions, correct_submissions, score, colleges(name)");
        if (pErr) throw pErr;

        const activeProfiles = (profiles || []).filter((p: any) => p.total_submissions > 0);
        setTotalStudents(activeProfiles.length);

        const { data: subs, error: sErr } = await supabase
          .from("submissions")
          .select("status");
        if (sErr) throw sErr;

        const allSubs = subs || [];
        setTotalSubmissions(allSubs.length);
        setCorrectCount(allSubs.filter((s: any) => s.status === "correct").length);
        setWrongCount(allSubs.filter((s: any) => ["wrong", "failed", "skipped"].includes(s.status)).length);
        setProcessingCount(allSubs.filter((s: any) => s.status === "processing").length);

        const collegeMap: Record<string, CollegePerf> = {};
        activeProfiles.forEach((p: any) => {
          const cName = p.colleges?.name || "Unknown";
          if (!collegeMap[cName]) {
            collegeMap[cName] = { name: cName, students: 0, correct: 0, total: 0, score: 0 };
          }
          collegeMap[cName].students++;
          collegeMap[cName].total += p.total_submissions;
          collegeMap[cName].correct += p.correct_submissions;
          collegeMap[cName].score += p.score;
        });
        setCollegePerformance(Object.values(collegeMap).sort((a, b) => b.score - a.score));
      } catch (e: any) {
        console.error("AdminStats error:", e);
        setError("Failed to load stats");
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (error) return <p className="text-center text-destructive py-8">{error}</p>;

  const correctPct = totalSubmissions > 0 ? Math.round((correctCount / totalSubmissions) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalStudents}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalSubmissions}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Correct</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{correctCount} <span className="text-sm font-normal text-muted-foreground">({correctPct}%)</span></p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wrong / Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{wrongCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
            <Clock className="h-4 w-4 text-accent-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-accent-foreground">{processingCount}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5" /> College Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {collegePerformance.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>College</TableHead>
                  <TableHead className="text-center">Active Students</TableHead>
                  <TableHead className="text-center">Total Submissions</TableHead>
                  <TableHead className="text-center">Correct</TableHead>
                  <TableHead className="text-center">Total Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collegePerformance.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-center">{c.students}</TableCell>
                    <TableCell className="text-center">{c.total}</TableCell>
                    <TableCell className="text-center">{c.correct}</TableCell>
                    <TableCell className="text-center font-bold text-primary">{c.score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
