/* eslint-disable react-refresh/only-export-components */
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        secondary:
          'border-transparent bg-slate-800 text-slate-300 border-slate-700',
        destructive:
          'border-transparent bg-red-500/20 text-red-300 border-red-500/30',
        outline:
          'text-slate-300 border-slate-700',
        amber:
          'border-transparent bg-amber-500/20 text-amber-300 border-amber-500/30',
        blue:
          'border-transparent bg-sky-500/20 text-sky-300 border-sky-500/30',
        purple:
          'border-transparent bg-purple-500/20 text-purple-300 border-purple-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
