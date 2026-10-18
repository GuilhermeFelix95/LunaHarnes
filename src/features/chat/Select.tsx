import { usePopover } from "../../ui/usePopover";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  /** Nome acessível do seletor (ex.: "Provedor"). */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/// Seletor em pílula com painel próprio, no mesmo estilo do seletor de modelo. Substitui o <select> nativo.
export function Select({ label, value, options, onChange, disabled }: SelectProps) {
  const { open, setOpen, root } = usePopover();
  const current = options.find((o) => o.value === value);


  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div className="select-menu" ref={root}>
      <button
        type="button"
        className="select-menu__trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((on) => !on)}
      >
        {current?.label ?? options[0]?.label ?? ""}
      </button>

      {open && (
        <div className="select-menu__panel" role="listbox" aria-label={label}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className="select-menu__item"
              onClick={() => choose(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
