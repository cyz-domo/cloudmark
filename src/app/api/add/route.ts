import { type NextRequest, NextResponse } from "next/server";
import { defaultMark } from "@/lib/types";
import { createBookmarkAction } from "@/lib/actions";
import { defaultCategory } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mark = searchParams.get("mark");
    const title = searchParams.get("title") || "Untitled";
    const url = searchParams.get("url");
    // 验证必要参数
    if (!mark) {
      const status = "error";
      const message = encodeURIComponent("markRequired");
      return NextResponse.redirect(
        new URL(
          `/${defaultMark}?status=${status}&message=${message}`,
          request.url
        )
      );
    }
    if (!url) {
      const status = "error";
      const message = encodeURIComponent("urlRequired");
      return NextResponse.redirect(
        new URL(
          `/${defaultMark}?status=${status}&message=${message}`,
          request.url
        )
      );
    }

    const formData = new FormData();
    formData.append("mark", mark);
    formData.append("url", url);
    formData.append("title", title);
    formData.append("category", defaultCategory);

    const [data, err] = await createBookmarkAction(formData);

    if (!data) {
      const status = "error";
      const message = encodeURIComponent(err.message);
      return NextResponse.redirect(
        new URL(`/${mark}?status=${status}&message=${message}`, request.url)
      );
    }
    const status = "success";
    const message = encodeURIComponent("bookmarkAdded");
    return NextResponse.redirect(
      new URL(`/${mark}?status=${status}&message=${message}`, request.url)
    );
  } catch (error) {
    const status = "error";
    const message = encodeURIComponent("processingError");
    console.error("Error processing bookmark:", error);
    return NextResponse.redirect(
      new URL(
        `/${defaultMark}?status=${status}&message=${message}`,
        request.url
      )
    );
  }
}
