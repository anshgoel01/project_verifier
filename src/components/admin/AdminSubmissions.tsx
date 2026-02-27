import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StatusBadge from "@/components/StatusBadge";
import { Loader2, FileCheck, ExternalLink, Trash2, Download, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Submission = {
  id: string;
  student_name: string;
  student_email: string;
  student_roll_no: string;
  college_name: string;
  coursera_link: string;
  linkedin_link: string;
  coursera_course: string | null;
  student_match: boolean | null;
  course_match: boolean | null;
  status: string;
  created_at: string;
  correct_submissions: number;
};

const PAGE_SIZE = 50;

const ALL_COLUMNS = [
  { key: "student_name", label: "Name", default: true },
  { key: "student_roll_no", label: "Roll No", default: true },
  { key: "college_name", label: "College", default: true },
  { key: "coursera_course", label: "Course", default: true },
  { key: "status", label: "Status", default: true },
  { key: "created_at", label: "Date", default: true },
  { key: "student_email", label: "Email", default: false },
  { key: "linkedin_link", label: "LinkedIn Link", default: false },
  { key: "coursera_link", label: "Coursera Link", default: false },
  { key: "marks", label: "Marks (floor(correct/3))", default: false },
  { key: "total_submissions", label: "No. of Submissions", default: false },
];

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
  const [selectedCollege, setSelectedCollege] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [exportCols, setExportCols] = useState<string[]>(
    ALL_COLUMNS.filter((c) => c.default).map((c) => c.key)
  );

  useEffect(() => {
    supabase.from("colleges").select("id, name").order("name").then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedCollege, selectedStatus]);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      let countQuery = supabase
        .from("submissions")
        .select("id", { count: "exact", head: true });
      let query = supabase
        .from("submissions")
        .select("id, coursera_link, linkedin_link, coursera_course, student_match, course_match, status, created_at, user_id, college_id")
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
        countQuery = countQuery.eq("status", selectedStatus);
      }
      if (selectedCollege !== "all") {
        query = query.eq("college_id", selectedCollege);
        countQuery = countQuery.eq("college_id", selectedCollege);
      }

      const [{ count }, { data: subs, error: sErr }] = await Promise.all([countQuery, query]);
      if (sErr) throw sErr;
      setTotalCount(count || 0);

      const userIds = [...new Set((subs || []).map((s: any) => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, roll_no, college_id, total_submissions, correct_submissions, colleges(name)")
        .in("user_id", userIds.length > 0 ? userIds : ["none"]);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

      const mapped: Submission[] = (subs || []).map((s: any) => ({
        id: s.id,
        student_name: profileMap[s.user_id]?.full_name || "Unknown",
        student_email: profileMap[s.user_id]?.email || "—",
        student_roll_no: profileMap[s.user_id]?.roll_no || "",
        college_name: profileMap[s.user_id]?.colleges?.name || "Unknown",
        coursera_link: s.coursera_link,
        linkedin_link: s.linkedin_link,
        coursera_course: s.coursera_course,
        student_match: s.student_match,
        course_match: s.course_match,
        status: s.status,
        created_at: s.created_at,
        correct_submissions: profileMap[s.user_id]?.correct_submissions || 0,
      }));

      setSubmissions(mapped);
    } catch (e) {
      console.error("AdminSubmissions error:", e);
      toast.error("Failed to load submissions");
    }
    setLoading(false);
  }, [selectedCollege, selectedStatus, page]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (!error) {
      toast.success("Submission deleted");
      fetchSubmissions();
    } else {
      toast.error("Failed to delete submission");
    }
    setDeletingId(null);
  };

  const toggleExportCol = (key: string) => {
    setExportCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleDownloadExcel = async () => {
    // Fetch ALL submissions (not just current page) for export
    let query = supabase
      .from("submissions")
      .select("id, coursera_link, linkedin_link, coursera_course, status, created_at, user_id, college_id")
      .order("created_at", { ascending: false });

    if (selectedStatus !== "all") query = query.eq("status", selectedStatus);
    if (selectedCollege !== "all") query = query.eq("college_id", selectedCollege);

    const { data: allSubs } = await query;
    if (!allSubs || allSubs.length === 0) {
      toast.error("No submissions to export");
      return;
    }

    const userIds = [...new Set(allSubs.map((s: any) => s.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, roll_no, total_submissions, correct_submissions, colleges(name)")
      .in("user_id", userIds);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

    const colMap: Record<string, (s: any) => any> = {
      student_name: (s) => profileMap[s.user_id]?.full_name || "Unknown",
      student_email: (s) => profileMap[s.user_id]?.email || "",
      student_roll_no: (s) => profileMap[s.user_id]?.roll_no || "",
      college_name: (s) => profileMap[s.user_id]?.colleges?.name || "Unknown",
      coursera_course: (s) => s.coursera_course || "",
      status: (s) => s.status,
      created_at: (s) => format(new Date(s.created_at), "MMM d, yyyy HH:mm"),
      linkedin_link: (s) => s.linkedin_link,
      coursera_link: (s) => s.coursera_link,
      marks: (s) => Math.floor((profileMap[s.user_id]?.correct_submissions || 0) / 3),
      total_submissions: (s) => profileMap[s.user_id]?.total_submissions || 0,
    };

    const selectedColDefs = ALL_COLUMNS.filter((c) => exportCols.includes(c.key));
    const headers = selectedColDefs.map((c) => c.label);
    const rows = allSubs.map((s: any) => selectedColDefs.map((c) => colMap[c.key](s)));

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Submissions");
    XLSX.writeFile(wb, "submissions_export.xlsx");
    toast.success("Excel file downloaded");
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" /> All Submissions ({totalCount})
          </CardTitle>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings2 className="h-4 w-4" /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <p className="text-sm font-medium mb-2">Export Columns</p>
                <div className="space-y-2">
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={exportCols.includes(col.key)}
                        onCheckedChange={() => toggleExportCol(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" className="gap-2" size="sm" onClick={handleDownloadExcel}>
              <Download className="h-4 w-4" /> Download Excel
            </Button>
          </div>
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
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="correct">Correct</SelectItem>
              <SelectItem value="wrong">Wrong</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : submissions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No submissions found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>College</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Links</TableHead>
                    <TableHead className="w-16">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.student_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.student_email}</TableCell>
                      <TableCell className="text-muted-foreground">{s.student_roll_no || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.college_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{s.coursera_course || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{format(new Date(s.created_at), "MMM d, HH:mm")}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <a href={s.coursera_link} target="_blank" rel="noopener" className="text-primary hover:underline"><ExternalLink className="h-4 w-4" /></a>
                          <a href={s.linkedin_link} target="_blank" rel="noopener" className="text-primary hover:underline"><ExternalLink className="h-4 w-4" /></a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                        >
                          {deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="gap-1">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
