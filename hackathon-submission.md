# Hackathon Submission

## Basic Information

### Project Title
Magic Play Place: Research-Grade Neuro-AI Lab

### Short Description (<=255 chars)
Magic Play Place is a neuroscience research platform that predicts neural-response patterns from multimodal inputs and runs validation-gated intervention simulations with evidence tags, async pipelines, and deploy-ready observability.

### Long Description (100+ words)
Magic Play Place is a research-first neurotechnology platform built to help teams rapidly test brain-response hypotheses and convert validated findings into commercializable products. Users can submit multimodal stimuli (text, image, video, audio) to the `/predict` pipeline, which returns structured insights with explicit evidence tags (`observed`, `inferred`, `hypothesis`) and non-clinical disclaimers. The `/generate` pipeline supports simulation mode by default and a validation-gated model-loop path for controlled optimization experiments. The system includes async job execution, retries/dead-letter handling, metrics, tracing, and deployment manifests for production operations. Target users are neuroscience researchers, digital therapeutics R&D teams, and innovation labs needing reliable experimentation infrastructure before clinical pathways.

### Technology Tags
FastAPI, Next.js, Python, TypeScript, Redis, Docker, Kubernetes, Prometheus, OpenTelemetry, Neuroscience AI

### Category Tags
HealthTech, Research Platform, AI Infrastructure, Multimodal AI, Neurotechnology

## Cover Image and Presentation

### Cover Image
- Format: PNG or JPG
- Aspect ratio: 16:9 recommended
- Direction: show UI + neural visualization + one line value prop

### Video Presentation (<=5 minutes)
1. 0:00-0:30 Problem and market gap
2. 0:30-1:30 Product overview and target users
3. 1:30-3:30 Live demo (`/predict`, `/generate`, diagnostics)
4. 3:30-4:30 Architecture and reliability (queue, retry, metrics, tracing)
5. 4:30-5:00 Business model and roadmap

### Slide Presentation (PDF)
1. Problem
2. Solution
3. Product demo flow
4. Technical architecture
5. Evidence policy and validation gates
6. Market sizing (TAM/SAM)
7. Competitor map and USP
8. Revenue model
9. Go-to-market plan
10. Next milestones

## App Hosting and Code Repository

### Public GitHub Repository
- Requirement: repo must be public for judging
- Include clear README with setup and architecture

### Demo Application Platform
- Frontend: Vercel (`frontend/`)
- Backend: Replit or equivalent public host (`backend/`)

### Application URL
- Submit a working URL with interactive prototype access
- Confirm CORS and API base URL are configured

## Pro Tips (Judging-Oriented)
- Start with problem and why current solutions are insufficient.
- Show user interaction quickly in the first 90 seconds.
- Keep claims aligned to non-clinical research boundary.
- Include TAM/SAM and explicit monetization path.
- Highlight reliability work (async queue, retries, observability).
- Keep slide text short (2-3 sentences per slide).

## Judging Criteria Mapping
- Presentation: clear narrative + fast live demo
- Business Value: B2B research platform with commercializable outputs
- Application of Technology: multimodal AI, validation gates, production ops
- Originality: evidence-governed neuro-AI experimentation workflow

## Fast Submission Checklist
- [ ] Finalize project title and short description in platform form
- [ ] Export PDF slide deck
- [ ] Record and upload <=5 minute MP4 demo
- [ ] Make GitHub repo public
- [ ] Deploy frontend and backend
- [ ] Validate demo URL from incognito browser
- [ ] Submit all required fields before deadline
