// finext-nextjs/app/(main)/news/components/NewsBreadcrumb.tsx
'use client';

import Link from 'next/link';
import { Breadcrumbs, Typography, Skeleton } from '@mui/material';
import MuiLink from '@mui/material/Link';

import { fontSize, spacing } from 'theme/tokens';

interface BreadcrumbItem {
    label: string;
    href?: string;
    /** Đánh dấu item đang loading */
    loading?: boolean;
}

interface NewsBreadcrumbProps {
    items: BreadcrumbItem[];
    /** Custom section label (default: "Tin tức") */
    sectionLabel?: string;
    /** Custom section href (default: "/news") */
    sectionHref?: string;
    /** Đang loading toàn bộ breadcrumb */
    loading?: boolean;
}

/** Skeleton cho breadcrumb item */
function BreadcrumbSkeleton({ width = 80 }: { width?: number }) {
    return (
        <Skeleton
            variant="text"
            width={width}
            height={20}
            sx={{ display: 'inline-block' }}
        />
    );
}

export default function NewsBreadcrumb({
    items,
    sectionLabel = 'Tin tức',
    sectionHref = '/news',
    loading = false,
}: NewsBreadcrumbProps) {
    // Nếu đang loading toàn bộ, hiển thị skeleton
    if (loading) {
        return (
            <Breadcrumbs
                separator="/"
                sx={{ mb: spacing.sm }}
            >
                <BreadcrumbSkeleton width={60} />
                <BreadcrumbSkeleton width={50} />
                <BreadcrumbSkeleton width={100} />
            </Breadcrumbs>
        );
    }

    return (
        <Breadcrumbs
            separator="/"
            sx={{ mb: spacing.sm }}
        >
            {/* Trang chủ */}
            <MuiLink
                component={Link}
                href="/"
                underline="hover"
                color="text.secondary"
                sx={{
                    fontSize: fontSize.sm,
                    '&:hover': {
                        color: 'primary.main',
                    },
                }}
            >
                Trang chủ
            </MuiLink>

            {/* Section link - Tin tức / Bản tin */}
            {items.length > 0 && items[0].href ? (
                <MuiLink
                    component={Link}
                    href={sectionHref}
                    underline="hover"
                    color="text.secondary"
                    sx={{
                        fontSize: fontSize.sm,
                        '&:hover': {
                            color: 'primary.main',
                        },
                    }}
                >
                    {sectionLabel}
                </MuiLink>
            ) : (
                <Typography
                    color="text.primary"
                    sx={{
                        fontSize: fontSize.sm,
                        fontWeight: 500,
                    }}
                >
                    {sectionLabel}
                </Typography>
            )}

            {/* Dynamic items */}
            {items.map((item, index) => {
                const isLast = index === items.length - 1;

                // Nếu item đang loading, hiển thị skeleton
                if (item.loading) {
                    return <BreadcrumbSkeleton key={index} width={isLast ? 120 : 80} />;
                }

                // Bỏ qua item nếu label rỗng
                if (!item.label) {
                    return null;
                }

                if (isLast || !item.href) {
                    return (
                        <Typography
                            key={index}
                            color="text.primary"
                            sx={{
                                fontSize: fontSize.sm,
                                fontWeight: 500,
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {item.label}
                        </Typography>
                    );
                }

                return (
                    <MuiLink
                        key={index}
                        component={Link}
                        href={item.href}
                        underline="hover"
                        color="text.secondary"
                        sx={{
                            fontSize: fontSize.sm,
                            '&:hover': {
                                color: 'primary.main',
                            },
                        }}
                    >
                        {item.label}
                    </MuiLink>
                );
            })}
        </Breadcrumbs>
    );
}
