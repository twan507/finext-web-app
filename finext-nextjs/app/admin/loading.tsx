// Loading UI cho admin — tái dùng RootLoading để nhất quán với Suspense fallback ở root layout.
import { RootLoading } from '../layout';

export default function Loading() {
  return <RootLoading />;
}
