/** Maximum bookmarks allowed per collection */
export const MAX_BOOKMARKS_PER_MARK = 1000;

/** Rate limit: max write requests per window per key */
export const RATE_LIMIT_MAX = 60;

/** Rate limit window in milliseconds (1 minute) */
export const RATE_LIMIT_WINDOW_MS = 60_000;

export const MARK_MIN_LENGTH = 4;
export const MARK_MAX_LENGTH = 64;
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const URL_MAX_LENGTH = 2048;
export const CATEGORY_MAX_LENGTH = 50;
export const TOKEN_MIN_LENGTH = 16;
export const TOKEN_MAX_LENGTH = 128;

/** Reserved marks that cannot be claimed */
export const RESERVED_MARKS = new Set(["demo", "default", "api", "doc", "static"]);

/** localStorage key prefix for write tokens */
export const TOKEN_STORAGE_PREFIX = "cloudmark:token:";

/** localStorage key prefix for dismissed migration banners */
export const BANNER_DISMISS_PREFIX = "cloudmark:banner-dismissed:";
