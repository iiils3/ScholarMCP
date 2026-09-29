# ScholarMCP

**Your Academic Operating System — من أول محاضرة إلى آخر درجة.**

ScholarMCP is an Arabic-first, mobile-first Student OS that turns a student's own course material into one connected workflow for understanding, studying, exam preparation, academic work, presentations, research and semester management.

## Product rule

Upload once, then reuse the same source everywhere. AI-generated study material is source-grounded and should point back to the student's material instead of inventing unrelated academic content.

## Current beta architecture

- **GitHub** — canonical source, CI quality gate, production build and GitHub Pages hosting.
- **Current browser engines** — Qwen, OCR and Whisper still run on the student's device in the published beta. The cloud summary backend in `server/` is an undeployed prototype; see its README before connecting it.
- **Neon PostgreSQL** — versioned schema for accounts and credits exists; the published frontend is not synchronized to it yet.
- **Browser data layer** — current beta keeps the student's course state and original source cache available in-browser while account synchronization is completed.
- **FSRS** — spaced-repetition scheduling remains lightweight and instant on-device.

## Working product surfaces

### Course Brain

- Courses and exam dates.
- PDF, DOCX, PPTX, TXT, Markdown and image ingestion.
- OCR fallback for scanned PDFs, photographed notes and handwriting-capable image processing.
- Page markers and Source Lens.
- Source-grounded course chat.
- Detailed summaries and key concepts.
- Translation with chunked processing for long files instead of silently dropping the end of the document.
- Mind maps.
- Exam-style quizzes with explanations and source references.
- Flashcards + FSRS review + Anki `.apkg` export.
- Editable Word and PowerPoint outputs.
- YouTube study-video discovery and embedded viewing.

### Lecture Intelligence

- Record a lecture from the microphone or upload an audio/video recording.
- Cloud speech-to-text transcription.
- Timestamp-aware transcript support when the provider returns segments.
- Turn the lecture into structured notes and study concepts.
- Generate flashcards from the lecture.
- Save the lecture transcript back into Course Brain so every other study tool can use it.

### Academic OS

- **Syllabus Magic** — upload a syllabus and extract course name, grading weights, deadlines, weekly topics and rules.
- Apply extracted deadlines directly to the ScholarMCP calendar.
- **Grade Planner** — weighted grade tracking and the exact score still needed to hit a target.
- **Seminar Studio** — source-grounded seminar outline, editable PPTX, Word copy and Speaker Notes.
- **Seminar Defense** — likely discussion questions, concise answers and delivery guidance based on the generated presentation.
- **Exam DNA** — analyze previous exams for question mix, repeated topics, difficulty and instructor style without pretending to predict future questions.
- **Smart Feed** — source-grounded, swipe-like fast review connected to FSRS rather than random doom-scrolling.

### Scholar Day

The Today screen builds a short adaptive mission list from:

- exam risk,
- due FSRS reviews,
- weak concepts,
- upcoming non-exam deadlines.

The goal is to answer the student's daily question: **"شنو أدرس هسه؟"** instead of presenting a wall of tools.

### Academic work and research

- Assignment and rubric workspace.
- Crossref/OpenAlex academic discovery flow.
- Academic artifact library.
- Calendar and deadlines.
- Full local backup/restore.

## Quality gate

Every production deployment now runs:

```bash
npm run qa
npm run typecheck
npm run build
```

The QA gate checks structural wiring and specific strings; it does not verify actual AI quality, cloud integration, account isolation, or credit transactions. The cloud prototype has focused validation tests via `npm run test:server`.

## Development

```bash
npm install
npm run dev
npm run qa
npm run typecheck
npm run build
```

## Production status

This repository is the active ScholarMCP beta. The published UI is still local-first. The next production step is an authenticated cloud pilot with a real identity provider, transaction tests on Neon, cost measurements and staged migration of the UI. Do not deploy the backend prototype as a public service yet.
