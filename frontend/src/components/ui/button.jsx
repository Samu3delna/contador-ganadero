/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 hover:bg-emerald-500 hover:shadow-emerald-500/20 active:bg-emerald-700',
        destructive:
          'bg-red-600 text-white shadow-md shadow-red-950/40 hover:bg-red-500 active:bg-red-700',
        outline:
          'border border-slate-700/80 bg-slate-900/40 text-slate-200 hover:bg-slate-800/80 hover:text-white hover:border-slate-600',
        secondary:
          'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-800/90 shadow-sm',
        ghost:
          'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100',
        link:
          'text-emerald-400 underline-offset-4 hover:underline p-0 h-auto',
        amber:
          'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-950/40 hover:bg-amber-400 active:bg-amber-600',
        gradient:
          'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-500/25',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-xl px-6 text-base font-semibold',
        icon: 'h-9 w-9 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
