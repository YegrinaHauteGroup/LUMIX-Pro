import { Sidebar } from '@/components/layout/Sidebar'
import { WorkspaceProvider } from '@/lib/workspace'
import { WorkspacePanel } from '@/components/workspace/WorkspacePanel'
import { getCenterInfo } from '@/lib/center'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const center = await getCenterInfo()

  return (
    <WorkspaceProvider>
      <div className="flex h-screen overflow-hidden bg-canvas">
        <Sidebar centerName={center?.name ?? null} />
        {/* width is pinned to viewport-minus-sidebar so the right edge (and the
            workspace rail) is never clipped by the parent's overflow-hidden */}
        <div className="flex h-screen min-w-0" style={{ marginLeft: '56px', width: 'calc(100vw - 56px)' }}>
          {/* main column — header stays confined here, never covered by the workspace */}
          <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
            {children}
          </div>
          {/* persistent workspace — survives page navigation (lives in the layout) */}
          <WorkspacePanel />
        </div>
      </div>
    </WorkspaceProvider>
  )
}
