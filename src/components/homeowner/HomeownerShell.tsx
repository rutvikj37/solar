import type { ReactNode } from 'react';
import { lazy, Suspense } from 'react';
import './homeowner.css';

const MobileStickyCTA = lazy(() =>
  import('@/components/homeowner/MobileStickyCTA').then((m) => ({ default: m.MobileStickyCTA }))
);

type HomeownerShellProps = {
  children: ReactNode;
  stickyCta?: boolean;
};

export function HomeownerShell({ children, stickyCta = true }: HomeownerShellProps) {
  return (
    <div className="homeowner-site min-h-screen bg-navy-dark text-white antialiased">
      {children}
      {stickyCta ? (
        <Suspense fallback={null}>
          <MobileStickyCTA />
        </Suspense>
      ) : null}
    </div>
  );
}
