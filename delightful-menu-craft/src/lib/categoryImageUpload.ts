import { supabase } from '@/lib/supabase';

const SIGNED_UPLOAD_FUNCTION = 'get-signed-upload-url';

interface SignedUploadData {
  signedUrl: string;
  filename: string;
  publicUrl: string;
}

// The edge function's response is untrusted, untyped JSON from across a network
// hop. Validate its shape (and that both URLs are real http(s) URLs) before we
// ever hand signedUrl to fetch() below — a malformed or unexpected host here
// should fail loudly instead of silently PUTing the file somewhere unintended.
function signedUploadDataFromResponse(data: unknown): SignedUploadData | null {
  if (!data || typeof data !== 'object') return null;
  const response = data as Record<string, unknown>;
  const nested = response.data;
  if (!nested || typeof nested !== 'object') return null;
  const result = nested as Record<string, unknown>;
  if (
    typeof result.signedUrl !== 'string' ||
    typeof result.filename !== 'string' ||
    typeof result.publicUrl !== 'string'
  ) return null;

  try {
    const signed = new URL(result.signedUrl);
    const publicUrl = new URL(result.publicUrl);
    if (!['https:', 'http:'].includes(signed.protocol) || !['https:', 'http:'].includes(publicUrl.protocol)) return null;
    return {
      signedUrl: result.signedUrl,
      filename: result.filename,
      publicUrl: result.publicUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Request a short-lived URL, then upload directly to S3 with exactly the same
 * Content-Type that was included in the signature. No local/object URL is saved.
 */
export async function uploadCategoryImage(file: File): Promise<string> {
  // Fail fast client-side; the edge function re-validates this too, but no
  // need to round-trip to the server for a type we already know is wrong.
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Only JPEG and PNG images are allowed.');
  }

  // Step 1: ask the edge function for a short-lived, pre-authorized upload URL.
  // No file bytes are sent yet — just metadata about the upload we intend to do.
  const { data, error } = await supabase.functions.invoke(SIGNED_UPLOAD_FUNCTION, {
    body: {
      name: file.name,
      folder: 'menu',
      fileType: file.type,
    },
  });
  if (error) throw new Error(error.message || 'Could not prepare the image upload.');

  const upload = signedUploadDataFromResponse(data);
  if (!upload) throw new Error('The server returned an invalid signed upload response.');

  // Step 2: upload directly to S3, bypassing our backend entirely. Content-Type
  // must match exactly what was signed, or S3 rejects the request.
  const uploadResponse = await fetch(upload.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error(`S3 upload failed (${uploadResponse.status}).`);
  }

  return upload.publicUrl;
}
