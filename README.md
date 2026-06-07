# Web App Offshore

A full-featured offshore inspection and operations management platform for managing subsea structural inspections — both **ROV** and **diving-based** — across oil and gas platforms, pipelines, and offshore structures.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Auth & Database | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Deployment | Netlify |
| Styling | Tailwind CSS, Radix UI / shadcn |
| State | Zustand, Jotai |
| Data Fetching | TanStack React Query, SWR |
| 3D Visualization | Three.js / React Three Fiber |
| Video Processing | FFmpeg WASM, MediaRecorder API |
| Reports | jsPDF, pdf-lib, docx, docxtemplater |
| Storage | AWS S3, Supabase Storage, Cloudinary |
| Testing | Vitest, Testing Library |

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn

### Setup

1. Copy environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

2. Update `.env.local` with your Supabase credentials:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```

3. Install dependencies and start the dev server:

   ```bash
   yarn install
   yarn dev
   ```

4. Open [localhost:3000](http://localhost:3000)

### Generate Supabase Types

```bash
npx supabase gen types typescript --db-url <your-db-url> > ./supabase/schema.ts
```

## Scripts

| Command | Description |
|---|---|
| `yarn dev` | Start development server |
| `yarn build` | Production build |
| `yarn start` | Start production server |
| `yarn lint` | Run ESLint |
| `yarn lint:fix` | Auto-fix lint issues |
| `yarn typecheck` | TypeScript type checking |
| `yarn format` | Format code with Prettier |
| `yarn test` | Run tests (Vitest watch mode) |
| `yarn test:run` | Run tests once |
| `yarn test:coverage` | Run tests with coverage |

## Project Structure

```
├── app/                        # Next.js App Router
│   ├── (auth-pages)/           # Sign-in, sign-up, forgot-password
│   ├── (main)/                 # Landing page
│   ├── api/                    # 36+ API route handlers
│   ├── auth/callback/          # OAuth callback
│   └── dashboard/              # Main authenticated application
│       ├── admin/              # User management
│       ├── field/              # Field operations (platform, pipeline)
│       ├── inspection/         # ROV & dive inspection workflows
│       ├── inspection-v2/      # Next-gen inspection interface
│       ├── jobpack/            # Job packs & Scope of Work (SOW)
│       ├── manager-overview/   # Executive dashboard
│       ├── planning/           # Inspection planning
│       ├── reports/            # Report wizard & datasheets
│       ├── settings/           # Defect criteria, MGI, video capture
│       ├── system-updates/     # System changelog
│       ├── user/               # User profile
│       └── utilities/          # Migration, library, smart query, QA/QC
├── components/                 # UI components
│   ├── ui/                     # Base design system (Radix-based)
│   ├── charts/                 # Chart components (anode, CP, anomaly trends)
│   ├── dialogs/                # Modal dialogs
│   ├── inspection/             # 3D view, checklist, video recorder widget
│   ├── video-player/           # Custom video player with FFmpeg
│   ├── jobpack/                # SOW dialog, vessel manager, wizard
│   └── forms/                  # Pipeline/platform spec forms
├── utils/                      # Utility modules
│   ├── supabase/               # Supabase client (client, server, middleware)
│   ├── report-generators/      # 51 report generators (ROV, dive, seabed)
│   ├── conversion/             # AI-assisted data conversion
│   ├── hooks/                  # Custom React hooks
│   └── schemas/                # Zod validation schemas
├── lib/                        # Core library
│   ├── video-recorder/         # Browser video recording engine
│   └── ...                     # Search, validation, utils
├── stores/                     # Zustand/Jotai state stores
├── types/                      # TypeScript type definitions
├── supabase/                   # Supabase config & migrations (45+)
├── docs/                       # Feature documentation
├── scripts/                    # Utility & debug scripts
├── sql/                        # Database migration & fix SQL files
├── info/                       # Reference docs, code patches, data dumps
├── scratch/                    # Scratch/temp files
├── middleware.ts                # Supabase session refresh (SSR auth)
├── netlify.toml                # Netlify deployment config
├── next.config.js              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── components.json             # shadcn/ui configuration
```

## Key Features

- **Inspection Workflows** — Full ROV and diving inspection lifecycle management
- **51 Report Generators** — Industry-standard PDF/DOCX reports (NACE, API, DNV)
- **Live Video Recording** — In-browser recording with FFmpeg WASM encoding
- **3D Visualization** — Platform and seabed rendering with Three.js
- **AI-Assisted Defect Analysis** — GPT/Gemini integration for data conversion
- **Scope of Work (SOW)** — Comprehensive SOW management with job pack wizard
- **Smart Query** — Cross-table query builder for inspection data
- **Executive Dashboard** — Manager-level overview and summary generation
- **Data Migration** — Oracle-to-Supabase migration utilities

## MISC

- npx supabase gen types typescript --db-url postgresql://postgres.zpsmxtdqlpbdwfzctqzd:yourpassword@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres > ./supabase/schema.ts
