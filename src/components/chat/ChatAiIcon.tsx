/**
 * Знак помощника: голова коровы (как на логотипе KazBeef) и «искра» ИИ между рогами.
 * Нарисован в сетке 24×24 линиями, как иконки Tabler, поэтому стоит в одном ряду с ними и берёт цвет текста.
 */
export function ChatAiIcon({ size = 24, stroke = 1.6 }: { size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* рога */}
      <path d="M7.7 9.2C5.8 8.9 4.4 7.6 4.3 5.6" />
      <path d="M16.3 9.2c1.9-.3 3.3-1.6 3.4-3.6" />
      {/* уши */}
      <path d="M7.4 10.4 3.3 10c.4 1.6 1.9 2.6 4.3 2.4" />
      <path d="m16.6 10.4 4.1-.4c-.4 1.6-1.9 2.6-4.3 2.4" />
      {/* голова и морда */}
      <path d="M9 9.1h6c1.1 0 1.9 1 1.7 2.1l-.7 3.9c1.2.6 1.6 2.3.9 3.6-.8 1.4-2.5 2.1-4.9 2.1s-4.1-.7-4.9-2.1c-.7-1.3-.3-3 .9-3.6l-.7-3.9C7.1 10.1 7.9 9.1 9 9.1Z" />
      {/* глаза и ноздри */}
      <path d="M10 12.6h.01M14 12.6h.01" strokeWidth={stroke * 1.6} />
      <path d="M10.6 17.7h.01M13.4 17.7h.01" strokeWidth={stroke * 1.4} />
      {/* искра ИИ */}
      <path
        d="M12 2.2l.75 1.75 1.75.75-1.75.75L12 7.2l-.75-1.75-1.75-.75 1.75-.75Z"
        fill="currentColor"
        strokeWidth={stroke * 0.6}
      />
      <path d="M17.6 1.9l.35.8.8.35-.8.35-.35.8-.35-.8-.8-.35.8-.35Z" fill="currentColor" strokeWidth={stroke * 0.5} />
    </svg>
  );
}
