import { type ReactNode } from 'react';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </div>
  );
}

