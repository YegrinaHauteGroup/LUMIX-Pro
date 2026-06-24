import { Sidebar } from '@/components/layout/Sidebar'
import { getCenterInfo } from '@/lib/center'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const center = await getCenterInfo()

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar centerName={center?.name ?? null} />
      <div className="flex-1 flex flex-col min-h-screen min-w-0" style={{ marginLeft: '216px' }}>
        {children}
      </div>
    </div>
  )
}
