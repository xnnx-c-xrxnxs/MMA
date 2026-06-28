---
name: webapp-file-upload-ux
description: Wire client-side file upload UI in the webapp using the `<FileDropzone>` primitive (`@old-st/ui`) and the `useFileUpload` hook (`@old-st/client-common`). Use this when adding any avatar / attachment / document upload that goes through `file-api-service` presigned S3 URLs.
---

# Webapp File Upload UX

The webapp uploads files **directly to S3** using presigned PUT URLs issued by `file-api-service`. The backend never sees file bytes, only metadata.

Architecture (matches Golden Rule #37):

```
Browser ──► POST /api/files/presigned-upload          ── (auth, returns uploadUrl + fileKey)
Browser ──► PUT  {uploadUrl} (binary file body)        ── (direct to S3, with progress)
Browser ──► PATCH /api/{domain}/{id}  body: { fileKey } ── (your domain mutation)
```

## Two pieces

| Piece | Source | Purpose |
|---|---|---|
| `<FileDropzone>` | `packages/ui/src/components/form-controls/file-dropzone/file-dropzone.tsx` | Accessible drag-and-drop / click-to-browse picker. No upload logic. |
| `useFileUpload()` | `packages/client-common/src/hooks/use-file-upload.ts` | Two-step presigned-URL upload with `progress`, `status`, `error`. |

## Minimal example

```tsx
'use client';
import { FileDropzone, Button, toast } from '@old-st/ui';
import { useFileUpload } from '@old-st/client-common';
import { useState } from 'react';

export function AvatarUpload({ onUploaded }: { onUploaded: (key: string) => void }) {
  const { upload, status, progress, error, reset } = useFileUpload();

  const handle = async (file: File) => {
    try {
      const fileKey = await upload(file);
      onUploaded(fileKey);
      toast.success('Avatar uploaded');
    } catch (err) {
      toast.error(`Upload failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-2">
      <FileDropzone
        onFileSelected={handle}
        accept="image/png,image/jpeg"
        maxSize={5 * 1024 * 1024}
        hint="PNG or JPG, up to 5 MB"
        disabled={status === 'requesting' || status === 'uploading'}
        onValidationError={(msg) => toast.error(msg)}
      />
      {status === 'uploading' && <ProgressBar value={progress} />}
      {status === 'error' && (
        <Button variant="outline" onClick={reset}>Try again</Button>
      )}
    </div>
  );
}
```

## Hook lifecycle

```
status:  idle ─► requesting ─► uploading ─► success
                                       └──► error  (preserves `error` until reset())
progress: 0..100 (only meaningful during 'uploading')
```

`upload(file)` resolves with the `fileKey` you should persist on your domain entity. **Do not** persist the `uploadUrl` — it expires.

## Showing the file later

```ts
import { fileApiClient } from '@old-st/client-common';

const { downloadUrl } = await fileApiClient.presignedDownload(fileKey);
// Use downloadUrl as <img src> or <a href>. URL expires; re-fetch on render.
```

For images, wrapping in a React Query hook (e.g. `useDownloadUrl(fileKey)`) is sensible to dedupe across components.

## Validation

`<FileDropzone>` performs client-side validation (`accept`, `maxSize`) and calls `onValidationError(msg)` with a human-readable message. The browser will also block the actual S3 PUT if the `Content-Type` doesn't match what was signed — make sure `useFileUpload` keeps using `file.type` (it does).

## Multiple files

The current primitive picks **one** file at a time. For multi-file flows, call `upload()` in a loop (or `Promise.all`), or extend `<FileDropzone>` to accept `multiple` (small change in the input element + the `onFileSelected` signature).

## Backend wiring

Make sure `fileApiUrl` is configured on app startup:

```ts
configureApi({
  // ...
  fileApiUrl: process.env.NEXT_PUBLIC_API_FILE_URL!,
});
```

The default is `http://localhost:3004/api`. The webapp's root `layout.tsx` should read `NEXT_PUBLIC_API_FILE_URL` and pass it through.

## Tests

Mock `fileApiClient.presignedUpload` and `XMLHttpRequest`. Drive `xhr.upload.onprogress` / `xhr.onload` manually and assert `progress` / `status` transitions. See `webapp-toast-notifications` for the toast assertion pattern.
