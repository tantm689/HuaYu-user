import TopNav from '@/components/TopNav'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <TopNav />
      {children}
    </div>
  )
}
