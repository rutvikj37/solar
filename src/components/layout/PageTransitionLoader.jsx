/**
 * Cold lazy chunks still use Suspense → FullPageLoader.
 * In-app navigation keeps the shell mounted and swaps Outlet content instantly.
 */
export default function PageTransitionLoader() {
  return null;
}
