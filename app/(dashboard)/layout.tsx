import { redirect } from 'next/navigation'
import { getServerUserProfile } from '@/lib/supabase-server'
import Sidebar from '@/components/dashboard/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getServerUserProfile()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar user={profile} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
