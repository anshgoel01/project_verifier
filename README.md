# ✅ Coursera Verification Platform

A web platform that allows students to submit their Coursera certificates for automated verification. The system scrapes the certificate page to extract the student's name and course title, then cross-checks it against their LinkedIn post to confirm they actually shared it — ensuring authenticity of completions.

## Table of Contents

1. [How to Use](#how-to-use)
2. [Features](#features)
3. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
4. [License](#license)

---

## How to Use

1. Go to the platform link and sign up with your **@thapar.edu** email.
2. Fill in your full name, roll number, and college during registration.
3. Once logged in, navigate to **Submit** from the navbar.
4. Paste your **Coursera share link** (e.g. `https://coursera.org/share/...`) and your **LinkedIn post link** where you shared the certificate.
5. Click **Verify** — the platform will automatically:
   - Extract your name and course title from the Coursera certificate page.
   - Check that your name matches your registered profile.
   - Confirm the course name appears in your LinkedIn post caption or hashtags.
6. If both checks pass, click **Submit** to record your completion.
7. View all your past submissions under **My Submissions**.
8. Track your score and rank on the **Leaderboard**.

---

## Features

- 🔐 **Email-restricted sign-up** — only `@thapar.edu` addresses allowed.
- 🤖 **Automated certificate verification** — scrapes Coursera share links to extract the learner name and course title.
- 🔗 **LinkedIn post cross-check** — verifies that the student mentioned the course in their LinkedIn post.
- 🧠 **Fuzzy name matching** — handles minor name differences between the certificate and the registered profile.
- 📋 **Submission history** — students can view all their past submissions grouped by course, with match results shown clearly.
- 🏆 **Live leaderboard** — ranks students by verified correct submissions in real time.
- 🛡️ **Admin dashboard** — admins can view stats, manage submissions, review admin access requests, and manage project weights by difficulty level.
- 📊 **Excel export** — admins can export submission data as `.xlsx` with selectable columns.
- ⚡ **Real-time updates** — submission statuses update live without requiring a page refresh.

---

## Getting Started

### Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)
- A [Supabase](https://supabase.com/) account and project
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/coursera-verification-platform
   cd coursera-verification-platform
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_HEAD_ADMIN_EMAILS=admin@thapar.edu
   VITE_THAPAR_COLLEGE_ID=your-college-uuid
   ```

4. **Run Supabase migrations:**
   ```bash
   npx supabase db push
   ```

5. **Deploy Supabase edge functions:**
   ```bash
   npx supabase functions deploy verify-submission
   npx supabase functions deploy admin-stats
   npx supabase functions deploy admin-submissions
   npx supabase functions deploy admin-leaderboard
   npx supabase functions deploy admin-export
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| UI Components | shadcn/ui + Tailwind CSS |
| Backend / Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email OTP) |
| Edge Functions | Deno (Supabase Functions) |
| Hosting | Vercel |

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

> 💬 Found a discrepancy with your submission status? Open an issue in the repository or contact the platform admin.
