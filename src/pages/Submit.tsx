import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";

const submissionSchema = z.object({
  courseraLink: z
    .string()
    .trim()
    .url("Coursera link must be a valid URL")
    .refine((value) => value.includes("coursera.org"), "Coursera link must be from coursera.org"),
  linkedinLink: z
    .string()
    .trim()
    .url("LinkedIn link must be a valid URL")
    .refine((value) => value.includes("linkedin.com"), "LinkedIn link must be from linkedin.com"),
});

type VerificationResult = {
  valid: boolean;
  errors: string[];
  coursera_name?: string | null;
  coursera_course?: string | null;
  linkedin_username?: string | null;
  student_match?: boolean | null;
  course_match?: boolean | null;
};

export default function Submit() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [courseraLink, setCourseraLink] = useState("");
  const [linkedinLink, setLinkedinLink] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  const resetVerificationIfNeeded = () => {
    if (verification) setVerification(null);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const parsed = submissionSchema.safeParse({ courseraLink, linkedinLink });
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => issue.message);
      setVerification({ valid: false, errors });
      return;
    }

    setVerifyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-submission", {
        body: {
          coursera_link: parsed.data.courseraLink,
          linkedin_link: parsed.data.linkedinLink,
          full_name: profile.full_name,
          user_id: user?.id,
        },
      });

      if (error) throw error;

      const result = (data || { valid: false, errors: ["Verification failed"] }) as VerificationResult;
      setVerification(result);

      if (result.valid) {
        toast.success("Verification passed. You can submit now.");
      } else {
        toast.error("Verification failed. Fix the links and try again.");
      }
    } catch (err: any) {
      setVerification({ valid: false, errors: [err.message || "Verification failed"] });
      toast.error(err.message || "Verification failed");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !profile || !verification?.valid) return;

    setSubmitLoading(true);
    try {
      const normalizedCoursera = courseraLink.trim();

      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("coursera_link", normalizedCoursera)
        .eq("status", "correct")
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error("This course has already been submitted and verified.");
        return;
      }

      const { error } = await supabase.from("submissions").insert({
        user_id: user.id,
        college_id: profile.college_id,
        coursera_link: normalizedCoursera,
        linkedin_link: linkedinLink.trim(),
        status: "correct",
        error_message: null,
        coursera_name: verification.coursera_name ?? null,
        coursera_course: verification.coursera_course ?? null,
        linkedin_username: verification.linkedin_username ?? null,
        student_match: verification.student_match ?? null,
        course_match: verification.course_match ?? null,
      });

      if (error) throw error;

      toast.success("Submission submitted successfully.");
      setCourseraLink("");
      setLinkedinLink("");
      setVerification(null);
      navigate("/my-submissions");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="container max-w-lg py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Student Submission
          </CardTitle>
          <CardDescription>
            Verify your Coursera and LinkedIn links first. Submit unlocks only after successful verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coursera">Coursera Certificate Link</Label>
              <Input
                id="coursera"
                value={courseraLink}
                onChange={(e) => {
                  setCourseraLink(e.target.value);
                  resetVerificationIfNeeded();
                }}
                placeholder="https://www.coursera.org/account/accomplishments/..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn Post Link</Label>
              <Input
                id="linkedin"
                value={linkedinLink}
                onChange={(e) => {
                  setLinkedinLink(e.target.value);
                  resetVerificationIfNeeded();
                }}
                placeholder="https://www.linkedin.com/posts/..."
                required
              />
            </div>

            {verification && !verification.valid && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive mb-1">Verification issues:</p>
                <ul className="list-disc pl-5 space-y-1 text-destructive">
                  {verification.errors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {verification?.valid ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Verification passed. You can submit now.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => setVerification(null)} disabled={submitLoading} className="gap-1.5">
                    <RefreshCcw className="h-4 w-4" /> Re-Verify
                  </Button>
                  <Button type="button" onClick={handleSubmit} disabled={submitLoading}>
                    {submitLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                      </>
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="submit" className="w-full" disabled={verifyLoading}>
                {verifyLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                  </>
                ) : verification ? (
                  <>
                    <RefreshCcw className="h-4 w-4" /> Verify Again
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
