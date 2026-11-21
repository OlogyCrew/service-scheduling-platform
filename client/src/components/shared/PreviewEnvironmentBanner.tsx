import { FlaskConical } from "lucide-react";
import { isUnpublishedPreviewHost } from "@/lib/previewEnvironment";
import { useEffect, useState } from "react";

export function PreviewEnvironmentBanner() {
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    setIsPreview(isUnpublishedPreviewHost(window.location.hostname));
  }, []);

  if (!isPreview) {
    return null;
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950" role="status">
      <div className="container flex max-w-7xl items-start justify-center gap-2 text-xs font-medium sm:text-sm">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong>Preview testing:</strong> this is unpublished code. Your signed-in account and actions can still use current OlogyCrew data.
        </p>
      </div>
    </div>
  );
}
