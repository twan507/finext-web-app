import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
    title: 'Đổi mật khẩu',
};

export default function ChangePasswordPage() {
    return <PageContent />;
}

