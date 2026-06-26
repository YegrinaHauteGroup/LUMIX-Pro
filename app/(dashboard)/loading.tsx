// Instant route-transition skeleton (Next streams this while the server
// component fetches), so navigation feels immediate instead of blocking.
export default function Loading() {
  return (
    <>
      <div className="h-12 shrink-0 border-b border-line bg-surface flex items-center px-4 gap-2">
        <div className="h-3 w-40 bg-fill rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-7 w-[260px] bg-fill rounded-[3px] animate-pulse" />
      </div>
      <div className="flex-1 min-h-0 p-4 overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 h-full min-h-0">
          <div className="xl:col-span-2 flex flex-col gap-3 min-h-0">
            <div className="h-48 bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)] animate-pulse" />
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
              {[0, 1, 2, 3].map((i) => <div key={i} className="bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)] animate-pulse" />)}
            </div>
          </div>
          <div className="flex flex-col gap-3 min-h-0">
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-square bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)] animate-pulse" />)}
            </div>
            <div className="flex-1 bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)] animate-pulse min-h-0" />
          </div>
        </div>
      </div>
    </>
  )
}
