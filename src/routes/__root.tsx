import notoSansLatinUrl from '@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2?url'
import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
  head: () => ({
    links: [
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        href: notoSansLatinUrl,
        crossOrigin: 'anonymous',
      },
    ],
  }),
})

function RootLayout() {
  return (
    <>
      <HeadContent />
      <div className="min-h-screen text-white">
        <Outlet />
      </div>
    </>
  )
}
