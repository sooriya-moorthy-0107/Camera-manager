# Equipment Checkout System 📸

An open-source, mobile-responsive management system designed to track camera gear and accessories during large-scale events. Built to eliminate the chaos of missing equipment by providing real-time accountability of who checked out what, and when it is due back.

## Features

* **Live Dashboard:** Instantly see what equipment is available and what is currently checked out.
* **Strict Accountability:** Every checkout is tied to an authenticated user's cryptographic identity.
* **Mobile-First UI:** Designed with Tailwind CSS for volunteers to use quickly on their phones at the checkout desk.
* **Historical Audit Trail:** Prevents deletion of equipment with a checkout history, ensuring complete records of past events.
* **Always-On Architecture:** Deployed on Next.js and Supabase for a 100% free, zero-sleep infrastructure.

## Tech Stack

* **Frontend:** [Next.js](https://nextjs.org/) (App Router), React, [Tailwind CSS](https://tailwindcss.com/)
* **Backend & Auth:** [Supabase](https://supabase.com/)
* **Database:** PostgreSQL

## Prerequisites

* Node.js 18+ installed
* A free [Supabase](https://supabase.com/) account
* A Vercel account (for free hosting)

## Getting Started

### 1. Database Setup

1. Create a new project in Supabase.
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. Execute the provided schema script (located in `/supabase/schema.sql` or from the project docs) to generate the `users`, `equipment`, and `checkout_logs` tables, along with their custom types and indexes.

### 2. Environment Variables

Create a `.env.local` file in the root directory of the project and add your Supabase project credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```