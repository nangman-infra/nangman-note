'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HomePageContent } from './_components/home/HomePageContent';

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageContent initialShowTrash={false} />}>
      <HomePageWithSearchParams />
    </Suspense>
  );
}

function HomePageWithSearchParams() {
  const searchParams = useSearchParams();
  const initialShowTrash = searchParams.get('view') === 'trash';

  return <HomePageContent initialShowTrash={initialShowTrash} />;
}
