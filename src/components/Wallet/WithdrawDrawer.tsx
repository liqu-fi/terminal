interface WithdrawDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WithdrawDrawer({ isOpen, onClose }: WithdrawDrawerProps) {
  if (!isOpen) return null;
  return (
    <div onClick={onClose} style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
      Withdraw unavailable
    </div>
  );
}
