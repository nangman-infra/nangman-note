import { Suspense } from 'react';
import { HomePageContent } from './_components/home/HomePageContent';

export default function HomePage() {
  // HomePageContent derives its state (view/meeting/trash) from
  // useSearchParams, which Next requires to be wrapped in Suspense.
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
