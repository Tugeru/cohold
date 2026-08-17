"use client";

import { ResourceStatus } from "@/components/ResourceStatus";

export default function DemoError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-3xl items-center px-4 py-12">
      <div className="w-full">
        <ResourceStatus
          title="This Cohold view could not load"
          message="No financial state was changed. Retry the view or return to another route."
          onRetry={reset}
        />
      </div>
    </main>
  );
}
