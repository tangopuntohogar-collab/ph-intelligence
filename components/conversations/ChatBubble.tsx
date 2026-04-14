import { Message } from '@/types'
import { FileText, Headphones, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { formatMessageDateTime } from '@/lib/utils'

interface ChatBubbleProps {
  message: Message
  vendorName?: string
  clientName?: string
}

export default function ChatBubble({ message, vendorName, clientName }: ChatBubbleProps) {
  const { from_me, content, type, msg_timestamp, media_url } = message
  const time = formatMessageDateTime(msg_timestamp)

  const senderLabel = from_me
    ? (vendorName ?? 'Vendedor')
    : (clientName ?? 'Cliente')

  return (
    <div className={`flex flex-col ${from_me ? 'items-end' : 'items-start'} mb-3`}>
      {/* Etiqueta de remitente */}
      <span className={`text-[10px] font-semibold mb-0.5 px-1 ${from_me ? 'text-primary' : 'text-gray-400'}`}>
        {senderLabel}
      </span>

      <div
        className={`max-w-[70%] rounded-xl px-3.5 py-2.5 shadow-sm ${
          from_me
            ? 'bg-primary text-white rounded-tr-none'
            : 'bg-white text-body border border-gray-200 rounded-tl-none'
        }`}
      >
        {type === 'image' && (
          media_url ? (
            <div className="mb-2">
              <a href={media_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={media_url}
                  alt="Imagen"
                  className="max-w-full rounded-lg max-h-72 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <ImageIcon size={14} />
              <span className="text-xs opacity-70">Imagen</span>
            </div>
          )
        )}
        {type === 'audio' && (
          <div className="flex items-center gap-2 mb-1">
            <Headphones size={14} />
            <span className="text-xs opacity-70">Audio</span>
            {media_url && (
              <a href={media_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
        {type === 'document' && (
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} />
            <span className="text-xs opacity-70">Documento</span>
            {media_url && (
              <a href={media_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">{content}</p>

        <p className={`text-xs mt-1 text-right ${from_me ? 'text-white/60' : 'text-gray-400'}`}>
          {time}
        </p>
      </div>
    </div>
  )
}
