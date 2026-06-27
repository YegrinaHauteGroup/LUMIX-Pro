import { Sidebar } from '@/components/layout/Sidebar'
import { getCenterInfo } from '@/lib/center'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const center = await getCenterInfo()

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar centerName={center?.name ?? null} />
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden" style={{ marginLeft: '56px' }}>
        {children}
      </div>
    </div>
  )
}
