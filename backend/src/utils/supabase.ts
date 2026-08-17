// backend/src/utils/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Polyfill global WebSocket for Node.js < 22 environment to prevent realtime client initialization errors
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as any).WebSocket = class {};
}

let supabaseAdminClient: SupabaseClient | null = null;

/**
 * Returns an authenticated Supabase server client using the server-side SUPABASE_SECRET_KEY.
 * The secret key bypasses Row-Level Security (RLS) policies for server operations.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseSecretKey = (
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Supabase configuration error: Missing SUPABASE_URL or SUPABASE_SECRET_KEY in server environment."
    );
  }

  supabaseAdminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdminClient;
}

/**
 * Uploads a Base64 image string to Supabase Storage and returns the permanent public HTTPS URL.
 *
 * @param base64Image - Base64 Data URI string (e.g. data:image/jpeg;base64,...)
 * @param bucketName - Target Supabase Storage bucket (default: "drug-AI")
 * @returns Object containing the public HTTPS URL and path in storage
 */
export const uploadImageToSupabase = async (
  base64Image: string,
  bucketName: string = "drug-AI"
): Promise<{ url: string; path: string }> => {
  if (!base64Image || typeof base64Image !== "string" || !base64Image.startsWith("data:image/")) {
    throw new Error("Invalid Base64 image format. Expected data:image/... URI.");
  }

  // Parse mime type and extension
  const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  const contentType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const ext = contentType.split("/")[1] || "jpeg";

  // Convert Base64 string to Buffer
  const base64Data = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  // Generate unique filename
  const filename = `carton_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;

  // Get authenticated server client with SUPABASE_SECRET_KEY
  const client = getSupabaseClient();

  // Upload buffer to target bucket
  const { data, error } = await client.storage
    .from(bucketName)
    .upload(filename, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("Supabase Storage upload failed:", {
      status: (error as any).statusCode || (error as any).status,
      message: error.message,
      name: error.name,
      bucket: bucketName,
      path: filename,
    });
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  // Retrieve public HTTPS CDN URL
  const { data: publicUrlData } = client.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  const publicUrl = publicUrlData.publicUrl;
  console.log(`✅ Supabase Storage Upload Success: ${publicUrl}`);

  return {
    url: publicUrl,
    path: data.path,
  };
};

export default uploadImageToSupabase;
