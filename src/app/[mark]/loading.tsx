import { Bookmark } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Bookmark className="h-6 w-6 text-primary/70" />
        </div>
      </div>
    </div>
  );
}
