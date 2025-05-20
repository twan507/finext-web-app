'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <main className="p-4 md:p-6">
      <div className="mb-8 space-y-4">
        <h1 className="font-semibold text-lg md:text-2xl">
          Đã xảy ra lỗi
        </h1>
        <p>
          Đã có lỗi xảy ra. Vui lòng thử lại.
        </p>
      </div>
      <button onClick={reset}>Thử lại</button>
    </main>
  );
}
