// The product logomark — a colorful "blurhash" squircle. Shared by the favicon,
// header and hero. `size` in px.
export default function Logo({ size = 32, className = '' }) {
  const id = 'lg' + size
  return (
    <svg
      className={`logo ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={`sq-${id}`}>
          <rect width="64" height="64" rx="17" />
        </clipPath>
        <filter id={`soft-${id}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <g clipPath={`url(#sq-${id})`}>
        <rect width="64" height="64" fill="#37d3ee" />
        <g filter={`url(#soft-${id})`}>
          <circle cx="13" cy="15" r="21" fill="#7b61ff" />
          <circle cx="53" cy="11" r="18" fill="#00c2e8" />
          <circle cx="51" cy="53" r="23" fill="#ffd15c" />
          <circle cx="11" cy="55" r="21" fill="#ff5c8a" />
          <circle cx="34" cy="35" r="14" fill="#2fe6a8" />
        </g>
      </g>
    </svg>
  )
}
