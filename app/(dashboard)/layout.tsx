import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { WorkspaceProvider } from '@/lib/workspace'
import { WorkspacePanel } from '@/components/workspace/WorkspacePanel'
import { getCenterInfo } from '@/lib/center'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const center = await getCenterInfo()

  return (
    <WorkspaceProvider>
      <div className="flex h-screen overflow-hidden bg-canvas">
        <Sidebar centerName={center?.name ?? null} />
        {/* width is pinned to viewport-minus-sidebar so the right edge is never
            clipped by the parent's overflow-hidden */}
        <div className="flex flex-col h-screen min-w-0" style={{ marginLeft: '56px', width: 'calc(100vw - 56px)' }}>
          {/* Fixed full-width header — never shrinks when the workspace opens */}
          <Header />
          {/* Row below the header: page content + workspace (starts under header) */}
          <div className="flex-1 flex min-h-0">
            <div id="app-main" className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {children}
            </div>
            {/* persistent workspace — survives page navigation (lives in the layout) */}
            <WorkspacePanel />
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  )
}
