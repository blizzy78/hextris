import { SlideTestPage } from '@/components/SlideTestPage'
import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/slide-test')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound()
    }
  },
  component: SlideTestPage,
})
