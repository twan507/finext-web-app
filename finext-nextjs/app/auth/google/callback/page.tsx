import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
    title: 'Xác thực Google',
};

export default function GoogleCallbackPage() {
    return <PageContent />;
}

