import "./page.css";
import { getBaseUrl, getCategories } from "@/lib/utils";
import { getBookmarkData } from "@/lib/actions";
import { BookmarkUI } from "@/components/bookmark-ui";
interface BookmarksPageProps {
  params: Promise<{ mark: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function BookmarksPage({
  params,
  searchParams,
}: BookmarksPageProps) {
  const { mark } = await params;
  const sp = await searchParams;
  const status = sp.status;
  const message = sp.message;
  let toast: { status: string; message: string } | null = null;
  if (status && message) {
    toast = { status, message };
  }
  const bookmarksData = await getBookmarkData({ mark });
  const categories = getCategories(bookmarksData);
  const baseUrl = getBaseUrl();

  return (
    <BookmarkUI
      mark={mark}
      bookmarksData={bookmarksData}
      categories={categories}
      toast={toast}
      baseUrl={baseUrl}
    />
  );
}
