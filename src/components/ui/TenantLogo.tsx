import Image from 'next/image'
import { cn } from '@/lib/utils'

interface TenantLogoProps {
  brandPath?: string
  variant?: 'full' | 'mark' | 'white'
  className?: string
}

export function TenantLogo({ brandPath = 'tallpa', variant = 'mark', className }: TenantLogoProps) {
  const file = variant === 'white' ? 'logo-white.svg' : variant === 'full' ? 'logo.svg' : 'logo-mark.svg'

  return (
    <div className={cn('flex h-[42px] w-[42px] items-center justify-center', className)}>
      <Image
        src={`/brands/${brandPath}/${file}`}
        alt="Logo"
        width={42}
        height={42}
        className="object-contain"
      />
    </div>
  )
}
