import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
    title: 'Licenses',
};

export default function LicensesPage() {
    return <PageContent />;
}

