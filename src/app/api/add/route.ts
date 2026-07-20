import { type NextRequest, NextResponse } from "next/server";
import { defaultMark, defaultCategory } from "@/lib/types";
import { createBookmarkAction } from "@/lib/actions";

function redirectWithStatus(
  request: NextRequest,
  mark: string,
  status: "success" | "error",
  message: string,
) {
  return NextResponse.redirect(
    new URL(
      `/${mark}?status=${status}&message=${encodeURIComponent(message)}`,
      request.url,
    ),
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mark = searchParams.get("mark");
    const token = searchParams.get("token");
    const title = searchParams.get("title") || "Untitled";
    const url = searchParams.get("url");

    if (!mark) {
      return redirectWithStatus(request, defaultMark, "error", "markRequired");
    }
    if (!token) {
      return redirectWithStatus(
        request,
        mark,
        "error",
        "tokenRequired",
      );
    }
    if (!url) {
      return redirectWithStatus(request, mark, "error", "urlRequired");
    }

    const formData = new FormData();
    formData.append("mark", mark);
    formData.append("token", token);
    formData.append("url", url);
    formData.append("title", title.slice(0, 200));
    formData.append("category", defaultCategory);

    const [data, err] = await createBookmarkAction(formData);

    if (!data) {
      const message = err?.message || "processingError";
      return redirectWithStatus(request, mark, "error", message);
    }

    return redirectWithStatus(request, mark, "success", "bookmarkAdded");
  } catch (error) {
    console.error("Error processing bookmark:", error);
    return redirectWithStatus(
      request,
      defaultMark,
      "error",
      "processingError",
    );
  }
}
