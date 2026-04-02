interface DepositDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositDrawer({ isOpen, onClose }: DepositDrawerProps) {
  if (!isOpen) return null;
  return (
    <div onClick={onClose} style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
      Deposit unavailable
    </div>
  );
}
