import Image from 'next/image'
import { User } from '@/types'

interface VendorAvatarProps {
  vendor: Pick<User, 'full_name' | 'avatar_url'>
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { container: 'w-7 h-7', text: 'text-xs', img: 28 },
  md: { container: 'w-9 h-9', text: 'text-sm', img: 36 },
  lg: { container: 'w-14 h-14', text: 'text-xl', img: 56 },
}

export default function VendorAvatar({ vendor, size = 'md' }: VendorAvatarProps) {
  const { container, text, img } = sizeMap[size]

  if (vendor.avatar_url) {
    return (
      <div className={`${container} rounded-full overflow-hidden shrink-0`}>
        <Image
          src={vendor.avatar_url}
          alt={vendor.full_name}
          width={img}
          height={img}
          className="object-cover w-full h-full"
          unoptimized
        />
      </div>
    )
  }

  const initials = vendor.full_name
    .split(' ')
    .slice(0, 2)
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()

  return (
    <div
      className={`${container} rounded-full bg-primary flex items-center justify-center text-white font-bold ${text} shrink-0`}
    >
      {initials}
    </div>
  )
}
