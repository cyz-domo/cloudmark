"use server";

import { BookmarkInstance, type BookmarksData, isDemoMark } from "@/lib/types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { DEMO_BOOKMARKS_DATA } from "@/data/demo_data";
import { createServerAction } from "zsa";
import { deleteSchema, insertSchema, updateSchema } from "./schema";

function generateUUID(): string {
  return crypto.randomUUID();
}

function createDefaultBookmarksData(mark: string): BookmarksData {
  return {
    mark,
    bookmarks: [],
  };
}

export async function getFavicon(url: string, size: number = 64) {
  const domain = new URL(url).hostname.replace("www.", "");
  // const faviconResponse = await fetch(`https://favicone.com/${domain}?json`);
  // const faviconData = await faviconResponse.json<{
  //   hasIcon: boolean;
  //   icon: string;
  //   format: string;
  // }>();
  // const favicon = faviconData.hasIcon ? faviconData.icon : "";
  // return favicon;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

export async function getBookmarkData(data: { mark: string }) {
  const { mark } = data;
  const isDemo = isDemoMark(mark);
  if (isDemo) {
    return DEMO_BOOKMARKS_DATA;
  }

  const KV = getCloudflareContext().env.cloudmark;
  const bookmarksdata = await KV.get<BookmarksData>(mark, "json");
  if (!bookmarksdata) {
    return null;
  }
  return bookmarksdata;
}

/**
 * Creates a new bookmark entry in the Cloudflare KV storage.
 *
 * This function handles the creation of a new bookmark by accepting input data
 * validated against the `insertSchema`. It checks if the bookmark already exists
 * and throws an error if it does. If the bookmark is new, it generates a UUID,
 * fetches the favicon, and stores the bookmark in the KV storage.
 *
 * @throws Will throw an error if the operation is in demo mode or if the bookmark already exists.
 *
 * @returns {Promise<BookmarkInstance>} The newly created bookmark instance.
 */
export const createBookmarkAction = createServerAction()
  .input(insertSchema, { type: "formData" })
  .handler(async ({ input }) => {
    const { mark, url, title, description, category } = input;
    const isDemo = isDemoMark(mark);
    if (isDemo) {
      throw "Demo mode";
    }

    const KV = getCloudflareContext().env.cloudmark;
    let bookmarksdata = await KV.get<BookmarksData>(mark, "json");
    if (!bookmarksdata) {
      bookmarksdata = createDefaultBookmarksData(mark);
    }
    if (bookmarksdata.bookmarks.find((b) => b.url === url)) {
      throw `Bookmark ${title} (${url}) already exists`;
    }

    const uuid = generateUUID();
    const favicon = await getFavicon(url);
    const newBookmark: BookmarkInstance = {
      uuid,
      url,
      title,
      description,
      category,
      favicon,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    bookmarksdata.bookmarks.push(newBookmark);
    await KV.put(mark, JSON.stringify(bookmarksdata));
    return newBookmark;
  });

/**
 * Updates an existing bookmark entry in the Cloudflare KV storage.
 *
 * This function handles the update of an existing bookmark by accepting input data
 * validated against the `updateSchema`. It checks if the bookmark exists and throws
 * an error if it does not. If the bookmark exists, it updates the bookmark with the
 * provided data and returns the updated bookmark.
 *
 * @throws Will throw an error if the operation is in demo mode or if the bookmark does not exist.
 *
 * @returns {Promise<BookmarkInstance>} The updated bookmark instance.
 */
export const updateBookmarkAction = createServerAction()
  .input(updateSchema, { type: "formData" })
  .handler(async ({ input }) => {
    const { mark, uuid, url, title, description, category } = input;
    const isDemo = isDemoMark(mark);
    if (isDemo) {
      throw "Demo mode";
    }

    const KV = getCloudflareContext().env.cloudmark;
    let bookmarksdata = await KV.get<BookmarksData>(mark, "json");
    if (!bookmarksdata) {
      throw `Bookmarks data for mark ${mark} not found`;
    }

    const bookmarkIndex = bookmarksdata.bookmarks.findIndex(
      (b) => b.uuid === uuid,
    );
    if (bookmarkIndex === -1) {
      throw `Bookmark with UUID ${uuid} not found`;
    }

    const updatedBookmark: BookmarkInstance = {
      ...bookmarksdata.bookmarks[bookmarkIndex],
      url,
      title,
      description,
      category,
      modifiedAt: new Date().toISOString(),
    };

    bookmarksdata.bookmarks[bookmarkIndex] = updatedBookmark;
    await KV.put(mark, JSON.stringify(bookmarksdata));
    return updatedBookmark;
  });

/**
 * Deletes a bookmark entry from the Cloudflare KV storage.
 *
 * This function handles the deletion of a bookmark by accepting input data
 * validated against the `deleteSchema`. It checks if the bookmark exists and throws
 * an error if it does not. If the bookmark exists, it removes the bookmark from
 * the bookmarks data array and updates the KV storage.
 *
 * @throws Will throw an error if the operation is in demo mode or if the bookmark does not exist.
 *
 * @returns {Promise<void>} The function returns a resolved promise when the bookmark is deleted.
 */
export const deleteBookmarkAction = createServerAction()
  .input(deleteSchema, { type: "formData" })
  .handler(async ({ input }) => {
    const { mark, uuid } = input;
    const isDemo = isDemoMark(mark);
    if (isDemo) {
      throw "Demo mode";
    }

    const KV = getCloudflareContext().env.cloudmark;
    const bookmarksdata = await KV.get<BookmarksData>(mark, "json");
    if (!bookmarksdata) {
      throw `Bookmarks data for mark ${mark} not found`;
    }

    const bookmarkIndex = bookmarksdata.bookmarks.findIndex(
      (b) => b.uuid === uuid,
    );
    if (bookmarkIndex === -1) {
      throw `Bookmark with UUID ${uuid} not found`;
    }

    bookmarksdata.bookmarks.splice(bookmarkIndex, 1);
    await KV.put(mark, JSON.stringify(bookmarksdata));
    return;
  });
