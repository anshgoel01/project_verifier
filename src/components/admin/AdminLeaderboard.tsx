import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";

type Entry = {
  user_id: string;
  full_name: string;
  college_name: string;
  total_submissions: number;
  correct_submissions: number;
  score: number;
  updated_at: string;
};

export default function AdminLeaderboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
  const [selectedCollege, setSelectedCollege] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    supabase.from("colleges").select("id, name").order("name").then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("profiles")
        .select("user_id, full_name, college_id, total_submissions, correct_submissions, score, updated_at, colleges(name)")
        .gt("total_submissions", 0)
        .order("score", { ascending: false })
        .order("updated_at", { ascending: true });

      if (selectedCollege !== "all") {
        query = query.eq("college_id", selectedCollege);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = (data || []).map((d: any) => ({
        user_id: d.user_id,
        full_name: d.full_name,
        college_name: d.colleges?.name || "Unknown",
        total_submissions: d.total_submissions,
        correct_submissions: d.correct_submissions,
        score: d.score,
        updated_at: d.updated_at,
      }));

      // Filter by date if set
      if (dateFrom) {
        const from = new Date(dateFrom);
        results = results.filter((r) => new Date(r.updated_at) >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        results = results.filter((r) => new Date(r.updated_at) <= to);
      }

      setEntries(results);
    } catch (e) {
      console.error("AdminLeaderboard error:", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLeaderboard(); }, [selectedCollege, dateFrom, dateTo]);

  const handleExport = () => {
    setExporting(true);
    const headers = ["Rank", "Student", "College", "Submissions", "Correct", "Score", "Last Activity"];
    const csvRows = [headers.join(",")];
    entries.forEach((e, i) => {
      csvRows.push([
        i + 1,
        `"${e.full_name}"`,
        `"${e.college_name}"`,
        e.total_submissions,
        e.correct_submissions,
        e.score,
        format(new Date(e.updated_at), "MMM d, yyyy"),
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leaderboard.csv";
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Admin Leaderboard
          </CardTitle>
          <Button onClick={handleExport} disabled={exporting} variant="outline" className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download CSV
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={selectedCollege} onValueChange={setSelectedCollege}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Colleges" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colleges</SelectItem>
              {colleges.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" placeholder="From" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" placeholder="To" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>College</TableHead>
                  <TableHead className="text-center">Submissions</TableHead>
                  <TableHead className="text-center">Correct</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e, i) => (
                  <TableRow key={e.user_id}>
                    <TableCell className="text-center font-mono">{i + 1}</TableCell>
                    <TableCell className="font-medium">{e.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.college_name}</TableCell>
                    <TableCell className="text-center">{e.total_submissions}</TableCell>
                    <TableCell className="text-center">{e.correct_submissions}</TableCell>
                    <TableCell className="text-center font-bold text-primary">{e.score}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(e.updated_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
