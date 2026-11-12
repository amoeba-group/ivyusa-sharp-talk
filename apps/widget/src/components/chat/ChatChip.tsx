/**
 * A follow-up chip in the chat thread: the quiet white pill the design uses
 * under every bot turn (SCR-IVY-11 "배송 조회 · 주문 취소 · 처음으로"). The
 * conversation-ending chip alone is outlined in blue (frame 65).
 */
export function ChatChip({
  label,
  onClick,
  disabled,
  emphasis = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** The blue outline of "End chat". */
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`st-quick-reply rounded-full border bg-white px-3.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 ${
        emphasis
          ? 'border-primary-400 text-primary-600 hover:bg-primary-50'
          : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}
