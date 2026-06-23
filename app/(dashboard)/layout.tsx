import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0" style={{ marginLeft: '216px' }}>
        {children}
      </div>
    </div>
  )
}
