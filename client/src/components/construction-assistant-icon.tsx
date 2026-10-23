type IconProps = {
  size?: number
  className?: string
}

export function ConstructionAssistantIcon({ size = 30, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6.5 9V8.4C6.5 5.7 8.7 3.5 11.4 3.5H12.6C15.3 3.5 17.5 5.7 17.5 8.4V9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 3.5V8.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 9H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M7 9.75H17C17.9665 9.75 18.75 10.5335 18.75 11.5V15.75C18.75 16.7165 17.9665 17.5 17 17.5H13L9 20V17.5H7C6.0335 17.5 5.25 16.7165 5.25 15.75V11.5C5.25 10.5335 6.0335 9.75 7 9.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M5.25 12.25H4.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M19.75 12.25H18.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9.75" cy="13.25" r="1" fill="currentColor" />
      <circle cx="14.25" cy="13.25" r="1" fill="currentColor" />
      <path d="M10 15.5H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
