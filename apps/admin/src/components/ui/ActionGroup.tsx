/**
 * ActionGroup: renders an audited action set as flat buttons while it fits
 * (fewer than OVERFLOW_AT), or a single ⋯ overflow menu beyond that, so a
 * crowded drawer row degrades into one control instead of wrapping.
 *
 * Menu selections defer the dialog until the menu's exit completes: focus is
 * restored to the ⋯ trigger first, the dialog then captures it on open, and
 * hands it back to the trigger on close (see ReasonDialog's focus effect).
 */

import { useState, type ReactNode } from "react";
import { EllipsisIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Menu, MenuItem } from "@/components/ui/Menu";

export interface ActionGroupItem<A extends string> {
  id: A;
  label: string;
  destructive?: boolean;
}

interface ActionGroupProps<A extends string> {
  /** Accessible name for the ⋯ overflow menu. */
  label: string;
  items: ActionGroupItem<A>[];
  /** Mounts one action's confirmation dialog; receives its close callback. */
  renderDialog: (id: A, onClose: () => void) => ReactNode;
}

/** Visible actions at which the row collapses into a ⋯ menu. */
const OVERFLOW_AT = 3;

export function ActionGroup<A extends string>({ label, items, renderDialog }: ActionGroupProps<A>) {
  const [menuOpen, setMenuOpen] = useState(false);
  /** Action picked from the menu, held until the menu finishes exiting. */
  const [pending, setPending] = useState<A | null>(null);
  const [target, setTarget] = useState<A | null>(null);

  if (items.length === 0) return null;

  const onMenuOpenChange = (open: boolean) => {
    setMenuOpen(open);
    if (!open && pending !== null) {
      setTarget(pending);
      setPending(null);
    }
  };

  return (
    <>
      {items.length >= OVERFLOW_AT ? (
        <Menu
          label={label}
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
          trigger={<EllipsisIcon size={18} />}
        >
          {items.map((item) => (
            <MenuItem key={item.id} destructive={item.destructive} onSelect={() => setPending(item.id)}>
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      ) : (
        items.map((item) => (
          <Button
            key={item.id}
            variant={item.destructive ? "destructive" : "outline"}
            onClick={() => setTarget(item.id)}
          >
            {item.label}
          </Button>
        ))
      )}
      {target !== null ? renderDialog(target, () => setTarget(null)) : null}
    </>
  );
}
