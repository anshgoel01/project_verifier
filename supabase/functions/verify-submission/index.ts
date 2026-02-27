import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type VerifyInput = {
  submission_id?: string;
  coursera_link?: string;
  linkedin_link?: string;
  full_name?: string;
  user_id?: string;
};

type VerifyResult = {
  valid: boolean;
  errors: string[];
  coursera_name: string | null;
  coursera_course: string | null;
  linkedin_username: string | null;
  student_match: boolean | null;
  course_match: boolean | null;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function parseNameParts(fullName?: string): string[] {
  if (!fullName) return [];
  return normalize(fullName)
    .split(" ")
    .filter((part) => part.length >= 3);
}

function isValidDomain(url: string, domain: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function hasAny(text: string, markers: string[]): boolean {
  const lower = text.toLowerCase();
  return markers.some((marker) => lower.includes(marker));
}

// Accept any coursera.org URL - no path restriction


function hasValidLinkedInPath(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return /\/posts\//i.test(pathname) || /\/feed\/update\//i.test(pathname);
  } catch {
    return false;
  }
}

function extractCourseFromPage(text: string): string | null {
  // Try to extract course name from page title or meta tags
  const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    // Coursera certificate pages typically have "Course Name | Coursera" in title
    const coursePart = title.replace(/\s*\|?\s*Coursera\s*$/i, "").trim();
    if (coursePart && coursePart.length > 3 && coursePart.toLowerCase() !== "coursera") {
      return coursePart;
    }
  }
  return null;
}

function extractLinkedInUsername(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/in\/([^/?#]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VerifyHubBot/1.0)",
      },
    });

    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyLinks(input: { courseraLink: string; linkedinLink: string; fullName?: string }): Promise<VerifyResult> {
  const errors: string[] = [];

  // Step 1: Domain validation
  if (!isValidDomain(input.courseraLink, "coursera.org")) {
    errors.push("Invalid URL: Coursera link must be from coursera.org");
  }

  if (!isValidDomain(input.linkedinLink, "linkedin.com")) {
    errors.push("Invalid URL: LinkedIn link must be from linkedin.com");
  } else if (!hasValidLinkedInPath(input.linkedinLink)) {
    errors.push("Invalid LinkedIn link: must be a public post URL (e.g. linkedin.com/posts/...)");
  }

  if (errors.length > 0) {
    return {
      valid: false, errors,
      coursera_name: null, coursera_course: null, linkedin_username: null,
      student_match: null, course_match: null,
    };
  }

  // Step 2: Fetch pages and validate content
  let courseraText = "";
  let linkedinText = "";

  try {
    const [courseraRes, linkedinRes] = await Promise.all([
      fetchText(input.courseraLink),
      fetchText(input.linkedinLink),
    ]);

    if (!courseraRes.ok) {
      errors.push(`Coursera link returned status ${courseraRes.status}. Make sure the certificate URL is correct and public.`);
    } else {
      courseraText = courseraRes.text;

      // Check for 404/not found pages
      if (hasAny(courseraText, [
        "sorry, we couldn't find the page",
        "the page you were looking for doesn't exist",
        "404 not found",
        "page not found",
      ])) {
        errors.push("Coursera certificate not found. Check the URL is correct.");
      }
      // Check for private/login-required pages
      else if (hasAny(courseraText, [
        "to view this page, log in",
        "you do not have access",
      ])) {
        errors.push("Coursera certificate is private. Make it publicly accessible.");
      }
      // Verify it's actually a certificate page with specific markers
      // Generic Coursera pages may contain "certificate" but not these specific phrases
      else {
        const isCertPage = hasAny(courseraText, [
          "has successfully completed",
          "verify this certificate",
          "an online non-credit course authorized by",
          "completed the online",
          "certificate recipient",
          "accomplishment",
        ]);
        
        // Also check the page title isn't just the generic Coursera homepage
        const titleMatch = courseraText.match(/<title[^>]*>([^<]+)<\/title>/i);
        const pageTitle = titleMatch?.[1]?.trim() || "";
        const isGenericTitle = /^coursera\s*\|?\s*(online courses|learn)/i.test(pageTitle);
        
        if (!isCertPage || isGenericTitle) {
          errors.push("This does not appear to be a valid Coursera certificate. Please use the direct certificate/accomplishment share link.");
        }
      }
    }

    if (!linkedinRes.ok) {
      errors.push(`LinkedIn link returned status ${linkedinRes.status}. Make sure the post URL is correct.`);
    } else {
      linkedinText = linkedinRes.text;
      if (hasAny(linkedinText, [
        "this post is unavailable",
        "this page doesn't exist",
        "content isn't available",
      ])) {
        errors.push("LinkedIn post is unavailable or private.");
      }
    }
  } catch {
    errors.push("Verification timed out. Please try again.");
  }

  // Step 3: Name matching on Coursera page
  const nameParts = parseNameParts(input.fullName);
  const normalizedPage = normalize(courseraText);

  let studentMatch: boolean | null = null;
  if (nameParts.length > 0 && normalizedPage.length > 0) {
    const matched = nameParts.some((part) => normalizedPage.includes(part));
    const hasOwnerContext = /awarded to|completed by|certificate recipient|presented to|has successfully/i.test(courseraText);
    studentMatch = matched ? true : hasOwnerContext ? false : null;
  }

  if (studentMatch === false) {
    errors.push("Name mismatch: your profile name was not found on the certificate page.");
  }

  // Step 4: Extract course name
  const courseFromPage = extractCourseFromPage(courseraText);
  const courseMatch = courseFromPage ? true : null;

  return {
    valid: errors.length === 0,
    errors,
    coursera_name: studentMatch ? input.fullName ?? null : null,
    coursera_course: courseFromPage,
    linkedin_username: extractLinkedInUsername(input.linkedinLink),
    student_match: studentMatch,
    course_match: courseMatch,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as VerifyInput;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Handle submission_id-based verification (re-verify existing)
    if (body.submission_id) {
      const { data: submission, error: submissionError } = await adminClient
        .from("submissions")
        .select("id, coursera_link, linkedin_link, user_id")
        .eq("id", body.submission_id)
        .maybeSingle();

      if (submissionError || !submission) {
        return new Response(JSON.stringify({ error: "Submission not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", submission.user_id)
        .maybeSingle();

      const result = await verifyLinks({
        courseraLink: submission.coursera_link,
        linkedinLink: submission.linkedin_link,
        fullName: profile?.full_name,
      });

      await adminClient
        .from("submissions")
        .update({
          status: result.valid ? "correct" : "wrong",
          error_message: result.valid ? null : result.errors.join(" | "),
          coursera_name: result.coursera_name,
          coursera_course: result.coursera_course,
          linkedin_username: result.linkedin_username,
          student_match: result.student_match,
          course_match: result.course_match,
        })
        .eq("id", body.submission_id);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Direct link verification
    if (!body.coursera_link || !body.linkedin_link) {
      return new Response(JSON.stringify({ error: "coursera_link and linkedin_link are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for duplicate submissions
    if (body.user_id) {
      const { data: existing } = await adminClient
        .from("submissions")
        .select("id")
        .eq("user_id", body.user_id)
        .eq("coursera_link", body.coursera_link.trim())
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({
          valid: false,
          errors: ["This Coursera certificate link has already been submitted. Use a different certificate."],
          coursera_name: null, coursera_course: null, linkedin_username: null,
          student_match: null, course_match: null,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const result = await verifyLinks({
      courseraLink: body.coursera_link,
      linkedinLink: body.linkedin_link,
      fullName: body.full_name,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      valid: false,
      errors: ["Unexpected verification error"],
      details: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
