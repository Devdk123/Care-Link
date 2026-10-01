export function CardSkeleton() {
  return (
    <div className="rounded-2xl glass p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-3 w-28 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
        <div className="skeleton h-14 w-14 rounded-full" />
      </div>
      <div className="mt-4 skeleton h-6 w-24 rounded-full" />
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="rounded-3xl glass p-6 shadow-soft">
        <div className="mx-auto skeleton h-40 w-40 rounded-full" />
        <div className="mt-6 space-y-2">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
        </div>
      </div>
      <div className="rounded-3xl glass p-6 shadow-soft">
        <div className="skeleton h-5 w-40 rounded" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-7 w-full rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
