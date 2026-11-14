# ROJGAR SETU — Firestore Security Specification

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`users`, `publicWorkers`, `workerPrivate`, `publicEmployers`, `employerPrivate`, `jobs`, `partnershipEnquiries`, `grievances`) must bind its owner UID (`uid`, `ownerUid`, `employerUid`, `submitterUid`, `reporterUid`, `workerUid`) to `request.auth.uid` upon creation and preserve immutability on updates.
2. **Privilege Escalation Prevention**: Users creating `/users/{userId}` can only assign `role` in `['worker', 'employer']`, never `'admin'`. Only an existing admin (`isAdmin()`) may modify roles or verification status (`verified`, `suspended`).
3. **PII Isolation**: Mobile numbers, email addresses, exact business addresses, GST numbers, and consent flags live exclusively in `users`, `workerPrivate`, `employerPrivate`, `partnershipEnquiries`, and `grievances` — readable only by the document owner or `isAdmin()`. Public discovery collections (`publicWorkers`, `publicEmployers`, `jobs`) never store personal phone numbers, personal emails, or live GPS coordinates.
4. **Live Location Privacy**: `liveLocationConsent` in `workerPrivate` defaults to opt-in control; `liveTrackingAuthorized` in `applications` can only be set by the `workerUid` after `status == 'accepted'`.
5. **Relational & Terminal State Integrity**: Job applications require `exists(/databases/$(database)/documents/jobs/$(incoming().jobId))` on create. Once a job reaches `'completed'` or `'cancelled'`, or an application reaches `'work_completed'`, non-admin updates are locked.
6. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt` is immutable on update and `updatedAt == request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Role Escalation on Signup**: `POST /users/attackerUid` with `{ role: "admin" }` -> `PERMISSION_DENIED`.
2. **Self-Verification Shadow Write**: `POST /publicWorkers/attackerUid` with `{ verificationStatus: "verified" }` -> `PERMISSION_DENIED` (must be `'pending'` on create unless `isAdmin()`).
3. **Ghost Field Injection**: `PATCH /publicWorkers/uid` adding `{ isFeatured: true, shadowBadge: "vip" }` -> `PERMISSION_DENIED` via `hasOnly` / `affectedKeys().hasOnly`.
4. **Cross-User PII Read**: Non-owner authenticated user reads `/workerPrivate/victimUid` -> `PERMISSION_DENIED`.
5. **Blanket Application Scraping**: Non-participant authenticated user runs `list` on `/applications` without `workerUid == auth.uid` or `employerUid == auth.uid` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Document ID > 128 chars or containing `$` / spaces on `get`/`create` -> `PERMISSION_DENIED` via `isValidId()`.
7. **Unbounded Array / Resource Exhaustion**: `skills` array with 50 entries or `description` > 2000 chars -> `PERMISSION_DENIED`.
8. **Forged Owner UID**: Creating `/jobs/job1` with `employerUid: "victimUid"` -> `PERMISSION_DENIED`.
9. **Orphaned Application**: Creating `/applications/app1` referencing non-existent `jobId: "fake_job_999"` -> `PERMISSION_DENIED` via `exists()`.
10. **Terminal State Tampering**: Worker modifying an application after `status == 'work_completed'` -> `PERMISSION_DENIED`.
11. **Unverified Email Spoofing**: Token with `email == 'mayurraikwar97@gmail.com'` and `email_verified: false` attempting admin write -> `PERMISSION_DENIED`.
12. **Client Timestamp Forgery**: Creating a job with backdated `createdAt: "2020-01-01T00:00:00Z"` -> `PERMISSION_DENIED` (`createdAt == request.time`).
