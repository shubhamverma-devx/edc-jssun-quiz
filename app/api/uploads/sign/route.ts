import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

/**
 * Incoming transformation applied by Cloudinary at upload time:
 * square face-crop avatar, auto quality. Must be signed along with
 * timestamp + folder — Cloudinary rejects unsigned extra params.
 */
const UPLOAD_TRANSFORMATION = "c_thumb,g_face,w_400,h_400,q_auto";

const ALLOWED_FOLDER_PREFIX = "edc-quiz/";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const folder = typeof body?.folder === "string" ? body.folder.trim() : "";

  if (!folder) {
    return NextResponse.json({ error: "folder_required" }, { status: 400 });
  }
  if (!folder.startsWith(ALLOWED_FOLDER_PREFIX) || folder.includes("..")) {
    return NextResponse.json({ error: "invalid_folder" }, { status: 400 });
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!apiSecret || !apiKey || !cloudName) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  try {
    // Cloudinary expects the timestamp in SECONDS, not milliseconds.
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder, transformation: UPLOAD_TRANSFORMATION },
      apiSecret
    );

    return NextResponse.json({
      timestamp,
      signature,
      apiKey,
      cloudName,
      folder,
      transformation: UPLOAD_TRANSFORMATION,
    });
  } catch {
    return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  }
}
