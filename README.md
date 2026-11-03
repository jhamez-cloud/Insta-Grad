# InstaGrad Frontend

InstaGrad is the frontend for an AI-powered question-and-answer dashboard that
generates answers from documents uploaded by its users.

The product keeps each AI session focused on an explicitly selected body of
knowledge. Instead of allowing a model to search every uploaded document, users
organize related documents into courses, group courses into libraries, and
launch sessions from a specific library. This bounded context helps the RAG
backend return more precise answers without mixing information from unrelated
documents.

## Knowledge structure

```text
Library
├── Course
│   ├── Document
│   └── Document
├── Course
│   └── Document
└── Sessions launched with this library's context
```

- **Document:** An uploaded source that may contain answers.
- **Course:** A collection of documents covering the same or closely related
  subject matter.
- **Library:** A collection of courses selected to form an AI knowledge scope.
- **Session:** A question-and-answer workspace launched from one library. Users
  can create, reopen, and continue sessions associated with that library.

When a user needs information from another document, the course containing that
document can be added to the relevant library. A session launched from that
library can then use the expanded, intentional document scope.

## Product flow

1. Upload documents and organize related documents into a course.
2. Add one or more courses to a library.
3. Launch or reopen a session associated with that library.
4. Ask questions using only the library's selected knowledge context.
5. Display the grounded answers returned by the external RAG service.

## Repository scope

This repository is exclusively responsible for:

- The responsive web dashboard and application UI
- Login, authentication, and protected frontend experiences
- Library, course, document, and session management interfaces
- The question-and-answer conversation experience
- Loading, empty, error, and account states
- Integrating the frontend with external application APIs

The following systems are deliberately outside this repository:

- The Retrieval-Augmented Generation (RAG) pipeline
- Document parsing, chunking, and embedding generation
- Vector storage and semantic retrieval
- AI model orchestration, prompting, and inference
- Backend persistence and API implementation

The frontend should treat those capabilities as external services and remain
independent of their internal implementation.

## Product principles

- **Precision through isolation:** Every session is constrained to the courses
  in its library, preventing unrelated documents from affecting an answer.
- **Explicit context:** Users control which knowledge sources are available by
  managing the courses in a library.
- **Clear hierarchy:** Libraries, courses, documents, and sessions should remain
  easy to understand and navigate.
- **Modern and efficient UI:** Interactions may use sophisticated motion and
  polished visuals, but must remain accessible, responsive, and resource-aware.
- **Frontend/backend separation:** UI code must not reproduce or depend on the
  internal implementation of the RAG pipeline.

## Technology

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS 4
- shadcn and Radix UI primitives
- `next-themes` for light, dark, and system themes
- Lucide icons

Project implementation rules, installed packages, skills, fonts, theme tokens,
and shared UI components are documented in [`AGENTS.md`](./AGENTS.md).

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Available commands

```bash
npm run dev        # Start the development server
npm run build      # Create a production build
npm run start      # Run the production server
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript checks
npm run format     # Format TypeScript and TSX files
```
