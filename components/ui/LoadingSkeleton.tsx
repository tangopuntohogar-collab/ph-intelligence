export function SkeletonCard() {
  return (
    <div className="bg-surface rounded-lg shadow-sm border border-border p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex justify-between">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-8 w-8 rounded-md" />
      </div>
      <div className="skeleton h-7 w-16 rounded" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="skeleton h-4 w-32 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-4 w-12 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-4 w-10 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
    </tr>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface rounded-lg shadow-sm border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-bg border-b border-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="skeleton h-3 w-16 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4 rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}
