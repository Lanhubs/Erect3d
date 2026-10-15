# Private Cloudflare R2 storage and file optimization

## Configuration

The production object store is Cloudflare R2. It uses R2's private S3-compatible API;
no AWS account is required. Copy the variables from `api/.env.r2.example` into the
server's ignored environment file. Use the account API endpoint, a private bucket,
`R2_REGION=auto`, and a bucket-scoped token with object read/write/delete permission.
Keep `r2.dev` access and public custom-domain access disabled. Never use `VITE_*` for keys.

API and worker use the same private bucket. The optional `filesystem` driver is useful
for local tests; it is not the production R2 configuration. Its root must be absolute,
outside the static web root, and writable only by the service account. Its signing key
must have at least 32 characters. Back up that private root if it contains retained data.

R2 setup references: [API compatibility](https://developers.cloudflare.com/r2/api/s3/api/),
[signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) and
[CORS](https://developers.cloudflare.com/r2/buckets/cors/).

## ZIP storage with exact source fidelity

The browser uses an authenticated, CSRF-protected `POST /api/v1/projects/:id/assets/optimized-upload`
with a binary body and a durable idempotency key. The API validates the original bytes,
then puts them in a lossless ZIP envelope only if it is smaller. It returns input
and stored sizes; retries reuse the same object. The old signed-upload/finalize API
remains available for other clients and also compresses the final object; its temporary
staging upload remains until cleanup. Prefer optimized ingestion to avoid that extra write.
Source linking, analysis and downloads operate on the restored original bytes and their
original SHA-256 checksum. Object size records the stored ZIP size; metadata records
the original size. Legacy unarchived objects remain readable.

- PNG, JPEG and PDF: exact original file bytes, including profiles, bit depth,
  orientation and other metadata. No image re-encoding or PDF rewriting occurs.
- Already compact files are kept when optimization cannot make them smaller. No fixed
  reduction percentage is promised. A separate analysis copy is avoided when the stored
  original image is already upright and matches the plan dimensions.
- Upright originals at all accepted dimensions are reused by normalization jobs.
  Rotation-only rasters use native-resolution lossless PNG. Display thumbnails are separate
  bounded WebP copies and are never used for interpretation;
  JSON exports already omit indentation and unnecessary whitespace.

Limits remain 200 MiB per upload and 100 million input image pixels. At most two upload
optimizations run concurrently in one API process. Nginx and Bun allow the binary upload
route's larger body; ordinary JSON requests retain their 2 MiB limit. Tune API process
count and memory after measuring large-plan workloads on the VPS.

## Bucket CORS and cleanup

ZIP objects use short-lived signed API download tickets; the API restores original bytes
with a bounded decoder and CRC integrity check. Tickets expire after 120 seconds, private
responses are never cached, and ZIP paths are never extracted onto disk. Legacy R2
objects still use direct signed GET URLs. Configure exact origins for those transfers, e.g.:

```json
[
  {
    "AllowedOrigins": ["https://erect3d.olanrewaju.xyz"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Set a one-day expiration lifecycle rule only on `staging/`. Durable cleanup jobs remove
abandoned staging objects earlier. Keep `private/` out of that rule. Monitor and reconcile
cleanup failures, because PostgreSQL and object storage cannot share an atomic commit.
R2 costs also depend on [operations](https://developers.cloudflare.com/r2/pricing/);
compression alone does not remove request charges.

## Verification

Local tests cover R2 signing/region, privacy checks, optimized ingestion/idempotency,
exact PNG/JPEG pixel preservation, orientation, and authenticated source linking.
Run `bun run check:storage` with real R2 credentials on staging to verify a generated compact
PNG through signed PUT/GET and unsigned account-endpoint denial. Set `LIVE_STORAGE_ORIGIN`
to the exact frontend origin to check its GET CORS response. The check deletes only its own
temporary object, including after a possibly successful PUT whose response was lost.
Unsigned account-endpoint denial does not prove public r2.dev/custom-domain access is off;
verify those settings separately in the Cloudflare dashboard.

The configured live endpoint was reached but returned **403 AccessDenied** for signed PUT.
Check that the credential belongs to this account and has Object Read & Write access to
the exact configured bucket ([Cloudflare setup](https://developers.cloudflare.com/r2/get-started/s3/)).
No real GET, cleanup or CORS success is claimed. Linux qpdf,
VPS capacity and backup recovery still require staging verification.
