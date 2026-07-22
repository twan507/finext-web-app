// finext-nextjs/app/(main)/news/[articleId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';
import { fetchArticleBySlug } from '../serverFetch';
import { serializeJsonLd } from '@/utils/jsonLd';

interface Props {
    params: Promise<{ articleId: string }>;
}

// Dynamic metadata — server-side, cached 5 phút (revalidate: 300 trong fetchArticleBySlug).
// Không ảnh hưởng tốc độ load phía client vì chỉ chạy trên server lúc render HTML.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { articleId } = await params;
    const article = await fetchArticleBySlug(articleId);

    // Fallback nếu bài viết không tồn tại hoặc API lỗi
    if (!article) {
        return {
            title: 'Tin tức',
            description: 'Cập nhật tin tức tài chính và thị trường chứng khoán Việt Nam.',
        };
    }

    // Truncate sapo cho description (tối đa 160 ký tự cho SEO)
    const description = article.sapo
        ? article.sapo.length > 160
            ? article.sapo.substring(0, 157) + '...'
            : article.sapo
        : 'Cập nhật tin tức tài chính và thị trường chứng khoán Việt Nam.';

    const ogImage = article.image
        ? { url: article.image, alt: article.title }
        : { url: 'https://finext.vn/finext-panel.png', width: 1200, height: 630, alt: 'Finext - Your Next Financial Step' };

    return {
        title: article.title,
        description,
        openGraph: {
            title: `${article.title} | Finext`,
            description,
            type: 'article',
            locale: 'vi_VN',
            siteName: 'Finext',
            url: `https://finext.vn/news/${articleId}`,
            images: [ogImage],
        },
        twitter: {
            card: article.image ? 'summary_large_image' : 'summary',
            title: article.title,
            description,
            images: article.image ? [article.image] : undefined,
        },
        alternates: { canonical: `/news/${articleId}` },
    };
}

export default async function NewsDetailPage({ params }: Props) {
    const { articleId } = await params;
    // fetch được Next.js dedupe (revalidate 300) nên không phát sinh call thừa so với generateMetadata
    const article = await fetchArticleBySlug(articleId);
    const pageUrl = `https://finext.vn/news/${articleId}`;

    // JSON-LD NewsArticle + BreadcrumbList — chỉ render khi có dữ liệu bài viết
    const jsonLd = article
        ? {
              '@context': 'https://schema.org',
              '@graph': [
                  {
                      '@type': 'NewsArticle',
                      headline: article.title,
                      description: article.sapo || undefined,
                      image: article.image ? [article.image] : ['https://finext.vn/finext-panel.png'],
                      datePublished: article.created_at || undefined,
                      dateModified: article.created_at || undefined,
                      inLanguage: 'vi',
                      mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
                      author: { '@type': 'Organization', name: 'Finext', url: 'https://finext.vn' },
                      publisher: {
                          '@type': 'Organization',
                          name: 'Finext',
                          logo: { '@type': 'ImageObject', url: 'https://finext.vn/icons/icon-512x512.png' },
                      },
                  },
                  {
                      '@type': 'BreadcrumbList',
                      itemListElement: [
                          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://finext.vn' },
                          { '@type': 'ListItem', position: 2, name: 'Tin tức', item: 'https://finext.vn/news' },
                          { '@type': 'ListItem', position: 3, name: article.title, item: pageUrl },
                      ],
                  },
              ],
          }
        : null;

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
                />
            )}
            <PageContent articleId={articleId} />
        </>
    );
}
