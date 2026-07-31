/**
 * POST /api/upload-image  (multipart, field "file")
 *
 * Uploads an image to Shopify Files and returns its CDN URL, for the email
 * builder's image blocks. Server-side proxy of Shopify's two-step flow:
 *   stagedUploadsCreate → POST the bytes to the staged target → fileCreate →
 *   poll until the MediaImage is READY and its image.url is available.
 *
 * Requires the `write_files` access scope. Admin-authenticated.
 */
import {
  json,
  unstable_parseMultipartFormData,
  unstable_createMemoryUploadHandler,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { authenticate } from "../shopify.server";

const MAX_BYTES = 5_000_000; // 5 MB

const STAGED_UPLOADS = `#graphql
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }`;

const FILE_CREATE = `#graphql
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id fileStatus ... on MediaImage { image { url } } }
      userErrors { field message }
    }
  }`;

const FILE_STATUS = `#graphql
  query fileStatus($id: ID!) {
    node(id: $id) { ... on MediaImage { fileStatus image { url } } }
  }`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  let file: File | null = null;
  try {
    const form = await unstable_parseMultipartFormData(
      request,
      unstable_createMemoryUploadHandler({ maxPartSize: MAX_BYTES })
    );
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return json({ error: "Image is too large (max 5 MB)." });
  }

  if (!file || file.size === 0) return json({ error: "No image selected." });
  if (!file.type.startsWith("image/")) return json({ error: "Please choose an image file." });
  if (file.size > MAX_BYTES) return json({ error: "Image is too large (max 5 MB)." });

  try {
    // 1. Staged target
    const staged = await admin.graphql(STAGED_UPLOADS, {
      variables: {
        input: [{
          filename: file.name || "email-image",
          mimeType: file.type,
          resource: "IMAGE",
          httpMethod: "POST",
          fileSize: String(file.size),
        }],
      },
    });
    const stagedJson: any = await staged.json();
    const stagedErr = stagedJson.data?.stagedUploadsCreate?.userErrors || [];
    if (stagedErr.length) return json({ error: stagedErr.map((e: any) => e.message).join(", ") });
    const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target?.url) return json({ error: "Could not start the upload." });

    // 2. Upload the bytes to the staged target (parameters must precede the file).
    const uploadForm = new FormData();
    for (const p of target.parameters as { name: string; value: string }[]) {
      uploadForm.append(p.name, p.value);
    }
    uploadForm.append("file", file, file.name || "email-image");
    const uploadRes = await fetch(target.url, { method: "POST", body: uploadForm });
    if (!uploadRes.ok) return json({ error: "Upload to storage failed." });

    // 3. Register the file
    const created = await admin.graphql(FILE_CREATE, {
      variables: {
        files: [{ alt: file.name || "", contentType: "IMAGE", originalSource: target.resourceUrl }],
      },
    });
    const createdJson: any = await created.json();
    const createErr = createdJson.data?.fileCreate?.userErrors || [];
    if (createErr.length) return json({ error: createErr.map((e: any) => e.message).join(", ") });
    const created0 = createdJson.data?.fileCreate?.files?.[0];
    if (!created0?.id) return json({ error: "Shopify did not accept the file." });

    let url: string | undefined = created0.image?.url;

    // 4. Poll until the image is processed and has a URL.
    for (let i = 0; i < 6 && !url; i++) {
      await sleep(700);
      const statusRes = await admin.graphql(FILE_STATUS, { variables: { id: created0.id } });
      const statusJson: any = await statusRes.json();
      url = statusJson.data?.node?.image?.url;
    }

    if (!url) return json({ error: "Image uploaded but is still processing — try again in a moment." });
    return json({ url });
  } catch (error: any) {
    // A missing write_files scope surfaces here as an access-denied GraphQL throw.
    const msg = String(error?.message || error);
    if (/access|scope|permission|forbidden/i.test(msg)) {
      return json({ error: "Image upload needs the ‘write_files’ permission. Re-open the app to grant it." });
    }
    console.error("[upload-image] error:", error);
    return json({ error: "Could not upload the image. Please try again." });
  }
};
