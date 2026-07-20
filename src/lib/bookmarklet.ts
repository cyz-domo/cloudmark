/**
 * Build the bookmarklet JavaScript URL that saves the current page.
 * Requires both mark and write token for authenticated writes.
 */
export function buildBookmarkletCode(
  baseUrl: string,
  mark: string,
  writeToken: string,
): string {
  // Keep the bookmarklet compact; encodeURIComponent is applied to page values at runtime
  const base = baseUrl.replace(/\/$/, "");
  return `javascript:(function(){var m=${JSON.stringify(mark)},k=${JSON.stringify(writeToken)},u=encodeURIComponent(location.href),t=encodeURIComponent(document.title);window.open(${JSON.stringify(base)}+'/api/add?mark='+encodeURIComponent(m)+'&token='+encodeURIComponent(k)+'&title='+t+'&url='+u,'_blank').focus()})()`;
}
