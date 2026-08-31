# ScholarMCP

ScholarMCP is an Arabic-first **Academic Operating System** for students: course workspaces, source-grounded study, mastery tracking, research, assignments and academic exports in one place.

## Current architecture

- **GitHub**: canonical source, change history, CI/CD, and frontend hosting through GitHub Pages.
- **Neon PostgreSQL**: dedicated ScholarMCP database project (separate from every other project/account workload).
- **Portable backend adapter**: runtime cloud access is isolated so Koyeb can be added only if persistent server-side AI/file processing is actually required.
- **Local-first fallback**: the public preview remains usable with local browser storage while the production Neon auth/API adapter is being wired.

## Implemented in the frontend

- Arabic RTL mobile-first dashboard and course workspaces.
- Course creation, exam dates, risk score and mastery UI.
- File parsing for PDF, DOCX, PPTX, TXT and Markdown.
- Source Lens and extracted page markers.
- Source retrieval, summaries, estimated coverage, quizzes, flashcards, mind maps and study sessions.
- Assignment/Rubric workspace.
- Crossref academic search and DOI links.
- YouTube topic discovery links.
- Word and editable PowerPoint export.
- Local deterministic fallback for study-generation features so the preview does not ship with dead buttons before the production AI service is connected.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Deployment

Every push to `main` runs type checking and a production build with GitHub Actions, then deploys `dist/` to GitHub Pages.

## Database

Neon schema migrations live under `database/neon/`. They are intentionally versioned in Git before production application.

## Status

Active development — ScholarMCP V0.1 foundation.
