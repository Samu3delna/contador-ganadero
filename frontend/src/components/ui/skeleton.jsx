import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }) {
  return (
    <div aria-hidden="true"
      className={cn('dashboard-skeleton rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
