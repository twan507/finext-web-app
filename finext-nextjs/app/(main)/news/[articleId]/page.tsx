// finext-nextjs/app/(main)/news/[articleId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';

interface Props {
    params: Promise<{ articleId: string }>;
}

// Base URL cho metadata
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://finext.vn';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.finext.vn';

// Fetch article từ API để generate metadata
async function fetchArticleForMetadata(articleSlug: string) {
    // Timeout sau 3 giây để đảm bảo crawler không bị trễ
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch(
            `${API_URL}/api/v1/sse/rest/news_article?article_slug=${encodeURIComponent(articleSlug)}&metadata_only=true`,
            {
                next: { revalidate: 60 }, // Cache 60 giây
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            return null;
        }

        const result = await response.json();
        return result.data?.article || null;
    } catch (error) {
        clearTimeout(timeoutId);
        // Log nhưng không throw - trả về null để dùng fallback metadata
        console.error('[generateMetadata] Failed to fetch article:', error);
        return null;
    }
}

// Dynamic metadata generation cho SEO và social sharing
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { articleId } = await params;
    const article = await fetchArticleForMetadata(articleId);

    // Fallback nếu không tìm thấy bài viết
    if (!article) {
        return {
            title: 'Finext - Tin tức',
            description: 'Xem chi tiết bài viết tin tức tài chính.',
            openGraph: {
                title: 'Finext - Tin tức',
                description: 'Xem chi tiết bài viết tin tức tài chính.',
                siteName: 'Finext',
                type: 'article',
                locale: 'vi_VN',
                images: [
                    {
                        url: `${BASE_URL}/finext-icon-trans.png`,
                        width: 512,
                        height: 512,
                        alt: 'Finext - Tin tức',
                    },
                ],
            },
        };
    }

    // Truncate sapo cho description (tối đa 160 ký tự)
    const description = article.sapo
        ? article.sapo.length > 160
            ? article.sapo.substring(0, 157) + '...'
            : article.sapo
        : 'Tin tức tài chính từ Finext';

    const articleUrl = `${BASE_URL}/news/${articleId}`;

    return {
        title: article.title,
        description: description,

        // Open Graph - cho Facebook, Zalo, Messenger, etc.
        openGraph: {
            title: article.title,
            description: description,
            url: articleUrl,
            siteName: 'Finext',
            type: 'article',
            locale: 'vi_VN',
            images: [
                {
                    url: `${BASE_URL}/finext-icon-trans.png`,
                    width: 512,
                    height: 512,
                    alt: article.title,
                },
            ],
        },

        // Twitter Card
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description: description,
            images: [`${BASE_URL}/finext-icon-trans.png`],
        },

        // Canonical URL
        alternates: {
            canonical: articleUrl,
        },
    };
}

export default async function NewsDetailPage({ params }: Props) {
    const { articleId } = await params;
    return <PageContent articleId={articleId} />;
}
