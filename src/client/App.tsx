import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { I18nProvider } from "@/client/i18n/context";
import { AppLayout } from "@/client/components/layout";
import { HomePage } from "@/client/pages/home";
import { DocPage } from "@/client/pages/doc";
import { CollectionPage } from "@/client/pages/collection";
import { NotFoundPage } from "@/client/pages/not-found";

export function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="doc" element={<DocPage />} />
            <Route path="demo" element={<CollectionPage />} />
            <Route path=":mark" element={<CollectionPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          {/* Reserved paths shouldn't be treated as marks in bookmarks API,
              but SPA still routes :mark — explicit redirects for safety */}
          <Route path="api/*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" closeButton />
    </I18nProvider>
  );
}
