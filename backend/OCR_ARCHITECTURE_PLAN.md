# OCR Architecture Plan (Future)

## Objective
Move OCR out of the synchronous API request path so the main backend stays responsive under load, while keeping current OCR quality and user flow.

## Scope
This document is an implementation playbook for:
- Backend async OCR jobs
- Dedicated OCR worker process/service
- Frontend polling flow
- Deployment and rollback strategy
- Operational guardrails (timeouts, retries, metrics)

## Current State (As-Is)
- Frontend sends image files directly to OCR endpoint and waits response.
- OCR runs inside API request lifecycle.
- Main OCR pipeline lives in `backend/app/services/hunts_ocr.py` and uses `pytesseract`.
- This couples heavy CPU OCR with all other API endpoints.

## Target State (To-Be)

### High-Level Architecture
1. Frontend
- Upload files and receive `job_id` quickly.
- Poll job status endpoint until `done` or `failed`.

2. Main API
- Accept OCR job creation requests.
- Persist job metadata/status in DB.
- Return status/result for a job.

3. OCR Worker
- Independently consumes pending jobs.
- Executes OCR pipeline.
- Writes normalized output back to DB.

4. Storage
- Save uploaded image files in object storage (recommended).
- Worker reads file from storage using key/path saved in job.

5. Database
- Acts as source of truth for queue state and results.

## Why This Approach
- Protects main API latency from OCR bursts.
- Scales OCR independently from auth/tasks/hunts endpoints.
- Easier observability: queue depth, job duration, fail rate.
- Supports retries and controlled concurrency.

## Data Model

### Suggested Enum
- `pending`
- `processing`
- `done`
- `failed`
- `canceled`

### Suggested Table: `ocr_jobs`
Columns:
- `id` UUID primary key
- `user_id` integer not null
- `character_id` integer null
- `status` varchar not null default `pending`
- `input_files_json` jsonb not null
- `result_json` jsonb null
- `error_message` text null
- `attempts` integer not null default 0
- `max_attempts` integer not null default 3
- `created_at` timestamp not null default now
- `started_at` timestamp null
- `finished_at` timestamp null
- `canceled_at` timestamp null
- `updated_at` timestamp not null default now

Indexes:
- `(status, created_at)` for queue scanning
- `(user_id, created_at desc)` for user history

### SQL Starter (Postgres)
```sql
create table if not exists ocr_jobs (
	id uuid primary key,
	user_id integer not null,
	character_id integer null,
	status varchar(20) not null default 'pending',
	input_files_json jsonb not null,
	result_json jsonb null,
	error_message text null,
	attempts integer not null default 0,
	max_attempts integer not null default 3,
	created_at timestamptz not null default now(),
	started_at timestamptz null,
	finished_at timestamptz null,
	canceled_at timestamptz null,
	updated_at timestamptz not null default now()
);

create index if not exists idx_ocr_jobs_status_created
	on ocr_jobs (status, created_at);

create index if not exists idx_ocr_jobs_user_created
	on ocr_jobs (user_id, created_at desc);
```

## API Contracts

### 1) Create OCR Job
`POST /hunts/ocr/jobs`

Request:
- `multipart/form-data`
- `files[]` (1..N images)
- `character_id` optional

Response `202 Accepted`:
```json
{
	"job_id": "uuid",
	"status": "pending",
	"created_at": "2026-04-04T12:00:00Z"
}
```

Validation rules:
- Max files per job: start with 8
- Max file size: start with 8 MB each
- Allowed mime: `image/png`, `image/jpeg`

### 2) Get OCR Job
`GET /hunts/ocr/jobs/{job_id}`

Response while running:
```json
{
	"job_id": "uuid",
	"status": "processing",
	"attempts": 1,
	"created_at": "...",
	"started_at": "..."
}
```

Response done:
```json
{
	"job_id": "uuid",
	"status": "done",
	"result": {
		"rows": [],
		"summary": {
			"processed_images": 2,
			"recognized_lines": 25,
			"duplicates_ignored": 3,
			"final_rows": 18
		},
		"warnings": []
	},
	"finished_at": "..."
}
```

Response failed:
```json
{
	"job_id": "uuid",
	"status": "failed",
	"error_message": "OCR processing failed after retries",
	"attempts": 3,
	"finished_at": "..."
}
```

### 3) Cancel OCR Job (optional now, recommended)
`POST /hunts/ocr/jobs/{job_id}/cancel`

Behavior:
- If `pending`, move to `canceled`
- If `processing`, mark cancel requested and worker exits gracefully after current step

## Frontend Implementation Notes

### Existing File
- `frontend/src/pages/hunts-page.jsx`

### Required Changes
1. Replace direct OCR call with job creation call.
2. Store `currentOcrJobId` in state.
3. Poll `GET /hunts/ocr/jobs/{id}` every 2-3 seconds.
4. Stop polling on `done`, `failed`, `canceled`, or when component unmounts.
5. Reuse existing rendering path for OCR `rows/summary/warnings`.

### UX States
- `uploading`
- `queued`
- `processing`
- `done`
- `failed`

### Polling Safeguards
- Max poll duration (ex: 180s)
- Exponential backoff after repeated 5xx
- "Try again" button on terminal failure

## Worker Design

### Process Loop
1. Fetch one `pending` job with lock (`FOR UPDATE SKIP LOCKED`).
2. Set `processing`, increment attempts, set `started_at`.
3. Download files from storage.
4. Run OCR pipeline (reuse current `hunts_ocr.py` logic).
5. Save `result_json`, set `done`, set `finished_at`.
6. On exception:
- If attempts < max_attempts: set back to `pending`
- Else: set `failed` with error message

### Concurrency
- Start single worker process, single job at a time.
- Increase parallelism only after measuring CPU and average job time.
- Avoid unconstrained thread pools for OCR.

### Pseudocode
```python
while True:
		job = claim_next_pending_job()
		if not job:
				sleep(1.5)
				continue

		try:
				mark_processing(job)
				files = load_input_files(job)
				result = run_ocr_pipeline(files)
				mark_done(job, result)
		except Exception as exc:
				handle_retry_or_fail(job, exc)
```

## Storage Strategy

### Recommended
- Use object storage key per uploaded file.
- Save keys in `input_files_json`.

Example `input_files_json`:
```json
[
	{
		"key": "ocr/2026/04/04/<uuid>/image_01.png",
		"name": "image_01.png",
		"size": 248123,
		"content_type": "image/png"
	}
]
```

### Temporary Option
- Local container disk only for local/dev testing.
- Do not rely on local disk for production durability.

## Environment Variables (Proposed)

Main API + Worker:
- `OCR_MAX_FILES_PER_JOB=8`
- `OCR_MAX_FILE_MB=8`
- `OCR_JOB_MAX_ATTEMPTS=3`
- `OCR_JOB_POLL_SECONDS=2`
- `OCR_JOB_TIMEOUT_SECONDS=180`

Storage:
- `OCR_STORAGE_PROVIDER=s3`
- `OCR_STORAGE_BUCKET=...`
- `OCR_STORAGE_REGION=...`
- `OCR_STORAGE_ACCESS_KEY=...`
- `OCR_STORAGE_SECRET_KEY=...`
- `OCR_STORAGE_ENDPOINT=...` (for S3 compatible providers)

Worker:
- `OCR_WORKER_ENABLED=true`
- `OCR_WORKER_CONCURRENCY=1`

## Render Deployment Plan

### Service Layout
1. `pxg-files-frontend` (existing static)
2. `pxg-files-backend` (existing API)
3. `pxg-files-ocr-worker` (new worker service)

### Recommended Sizing (starting point)
- API service: keep current scale target for normal traffic
- OCR worker: 4 GB minimum, 8 GB preferred for safer peaks

### Worker Start Command
Use one of:
- Dedicated Python module entrypoint (recommended)
- Management command style runner

## Reliability and Backpressure

Rules:
- Reject new jobs when queue depth exceeds threshold (ex: 200 pending)
- Return `429` with retry hint when throttled
- Enforce per-user rate limit
- Enforce max processing time per job

## Observability (Must-Have)

Metrics:
- `ocr_jobs_pending_count`
- `ocr_job_duration_seconds`
- `ocr_jobs_failed_total`
- `ocr_jobs_retried_total`
- `ocr_images_processed_total`

Logs (structured):
- job lifecycle transitions
- attempt count
- error class and short message

Dashboards/alerts:
- Pending queue > threshold
- Fail rate > 10% in 15 min
- P95 job duration above expected target

## Security Controls
- Validate file mime and extension
- Scan image metadata defensively
- Hard cap on file count and total payload per job
- Store only required metadata
- Keep auth checks on status endpoint (job owner/admin only)

## Migration Plan (Phased)

### Phase 1: Foundation
- Create `ocr_jobs` model + migration
- Create storage abstraction
- Add config/env defaults

### Phase 2: API Async Endpoints
- Implement create job endpoint
- Implement get job endpoint
- Keep old sync endpoint intact

### Phase 3: Worker
- Implement worker loop
- Wire to existing OCR parser
- Add retries + failure handling

### Phase 4: Frontend Switch
- Update Hunts page to async polling flow
- Add feature flag fallback to old sync endpoint

### Phase 5: Stabilization
- Monitor metrics for 1-2 weeks
- Tune retry/concurrency
- Disable old sync path when stable

## Rollback Plan
- Keep sync endpoint behind feature flag until async path is stable
- If async path degrades:
1. Disable worker routing feature flag
2. Re-enable sync endpoint for OCR processing
3. Keep stored jobs for forensic analysis

## Test Plan

### Unit Tests
- Job state transitions
- Retry decisions
- Validation (file limits, mime)

### Integration Tests
- Create job and complete success path
- Fail then retry then success
- Permanent fail after max attempts
- Access control for job status endpoint

### Load Tests
- Baseline: 1, 3, 5, 10 concurrent jobs
- Measure P50/P95 job time, fail rate, queue growth

## Suggested File-by-File Implementation Map

Backend:
- Add `backend/app/models/ocr_job.py`
- Add schema in `backend/app/schemas/hunts.py` (job responses)
- Add async routes in `backend/app/api/hunts.py`
- Add worker entrypoint `backend/app/workers/ocr_worker.py`
- Add storage helper `backend/app/services/ocr_storage.py`

Frontend:
- Update `frontend/src/pages/hunts-page.jsx` for async job flow
- Optional: add polling helper in `frontend/src/services/ocr-jobs.js`

Infra:
- Update `render.yaml` to include worker service

## Definition of Done
- OCR no longer blocks API request lifecycle
- Main API remains responsive during OCR bursts
- OCR results match current format expected by frontend
- Monitoring/alerts exist for queue and failures
- Feature flag allows safe rollback

---
Owner: Team PXG Files
Status: Ready for phased implementation
Last updated: 2026-04-04
