// STUB – owned by the "arsenal/shell" builder. Contract: <CommandPalette open onOpenChange />
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={() => onOpenChange(false)}>
      <div className="jx-aug p-6" data-augmented-ui="tl-clip br-clip border">Paleta poleceń – w budowie</div>
    </div>
  )
}
