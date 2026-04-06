// finext-nextjs/app/page.tsx
// Root route (/) — SEO entry point.
// Metadata được Google index: "Finext — Your Next Financial Step".
// Client-side redirect sang /home để user trải nghiệm nội dung.
// Googlebot sẽ thấy metadata + canonical URL mà KHÔNG bị redirect server-side.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Finext — Your Next Financial Step' },
  description:
    'Finext — Nền tảng phân tích chứng khoán thông minh. ' +
    'Theo dõi thị trường, sàng lọc cổ phiếu và đọc báo cáo chuyên sâu cho nhà đầu tư Việt Nam.',
  openGraph: {
    title: 'Finext — Your Next Financial Step',
    description:
      'Nền tảng phân tích chứng khoán thông minh. Theo dõi thị trường, sàng lọc cổ phiếu và đọc báo cáo chuyên sâu cho nhà đầu tư Việt Nam.',
  },
  alternates: {
    canonical: 'https://finext.vn',
  },
};

// Client component wrapper để redirect — metadata vẫn được render server-side
import RootRedirect from './RootRedirect';

export default function RootPage() {
  return <RootRedirect />;
}
