import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#080808]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen" style={{ marginLeft: '200px' }}>
        {children}
      </div>
    </div>
  )
}
