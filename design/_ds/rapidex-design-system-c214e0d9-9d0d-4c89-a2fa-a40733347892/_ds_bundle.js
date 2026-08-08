/* @ds-bundle: {"format":4,"namespace":"RapidexDesignSystem_c214e0","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Checkbox","sourcePath":"components/core/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"KanbanColumn","sourcePath":"components/domain/KanbanColumn.jsx"},{"name":"OrderCard","sourcePath":"components/domain/OrderCard.jsx"},{"name":"StatusBadge","sourcePath":"components/domain/StatusBadge.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"BranchSelector","sourcePath":"components/navigation/BranchSelector.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Button.jsx":"5a34e3728658","components/core/Card.jsx":"36cbe24956c9","components/core/Checkbox.jsx":"a0e14d94c3c2","components/core/IconButton.jsx":"957a9665eca8","components/core/Input.jsx":"33134a5699fe","components/core/Select.jsx":"3665974edf9b","components/core/Switch.jsx":"ed213398fc1f","components/core/Tag.jsx":"6223682730b2","components/domain/KanbanColumn.jsx":"f04125c553e1","components/domain/OrderCard.jsx":"c0499aaaf524","components/domain/StatusBadge.jsx":"17c683211731","components/feedback/Dialog.jsx":"82175b64dcd4","components/feedback/Toast.jsx":"0944e7067bfe","components/feedback/Tooltip.jsx":"ec5e58558a5d","components/navigation/BranchSelector.jsx":"2f19b1b54b73","components/navigation/Sidebar.jsx":"2407b668b451","components/navigation/Tabs.jsx":"ebb915bbe4dc","ui_kits/painel-lojista/CardapioScreen.jsx":"9933f509b5fe","ui_kits/painel-lojista/ConfiguracoesScreen.jsx":"6792e731000a","ui_kits/painel-lojista/Icons.jsx":"9f4534ad05d2","ui_kits/painel-lojista/KanbanScreen.jsx":"5612dfef4c25","ui_kits/painel-lojista/data.js":"d54abe41b51e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RapidexDesignSystem_c214e0 = window.RapidexDesignSystem_c214e0 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
const sizes = {
  sm: {
    h: 32,
    px: 12,
    fs: 'var(--text-sm)',
    gap: 6,
    radius: 'var(--radius-sm)'
  },
  md: {
    h: 40,
    px: 16,
    fs: 'var(--text-base)',
    gap: 8,
    radius: 'var(--radius-md)'
  },
  lg: {
    h: 48,
    px: 20,
    fs: 'var(--text-md)',
    gap: 8,
    radius: 'var(--radius-md)'
  }
};
const variants = {
  primary: {
    bg: 'var(--brand)',
    fg: 'var(--text-on-brand)',
    border: 'transparent',
    hoverBg: 'var(--brand-hover)',
    activeBg: 'var(--brand-active)'
  },
  secondary: {
    bg: 'var(--bg-surface-raised)',
    fg: 'var(--text-primary)',
    border: 'var(--border-default)',
    hoverBg: 'var(--bg-hover)',
    activeBg: 'var(--bg-active)'
  },
  ghost: {
    bg: 'transparent',
    fg: 'var(--text-secondary)',
    border: 'transparent',
    hoverBg: 'var(--bg-hover)',
    activeBg: 'var(--bg-active)'
  },
  danger: {
    bg: 'var(--danger)',
    fg: '#FFFFFF',
    border: 'transparent',
    hoverBg: 'var(--danger-hover)',
    activeBg: 'var(--danger-active)'
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  fullWidth = false,
  children,
  onClick,
  style
}) {
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const bg = disabled ? 'var(--bg-surface-raised)' : active ? v.activeBg : hover ? v.hoverBg : v.bg;
  const fg = disabled ? 'var(--text-disabled)' : v.fg;
  return React.createElement('button', {
    disabled,
    onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      height: s.h,
      padding: `0 ${s.px}px`,
      fontFamily: 'var(--font-sans)',
      fontSize: s.fs,
      fontWeight: 'var(--weight-semibold)',
      color: fg,
      background: bg,
      border: `1px solid ${disabled ? 'var(--border-subtle)' : v.border}`,
      borderRadius: s.radius,
      cursor: disabled ? 'not-allowed' : 'pointer',
      width: fullWidth ? '100%' : undefined,
      transition: 'background .12s ease,transform .08s ease',
      transform: active && !disabled ? 'scale(.98)' : 'scale(1)',
      whiteSpace: 'nowrap',
      ...style
    }
  }, icon && iconPosition === 'left' ? icon : null, children, icon && iconPosition === 'right' ? icon : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  children,
  padding = 20,
  style
}) {
  return React.createElement('div', {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding,
      boxShadow: 'var(--shadow-elevation)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Checkbox.jsx
try { (() => {
function Checkbox({
  checked,
  onChange,
  label,
  disabled
}) {
  return React.createElement('label', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1
    }
  }, React.createElement('span', {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 18,
      height: 18,
      borderRadius: 5,
      border: `1px solid ${checked ? 'var(--brand)' : 'var(--border-strong)'}`,
      background: checked ? 'var(--brand)' : 'transparent',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'background .12s ease'
    }
  }, checked ? React.createElement('span', {
    style: {
      color: 'var(--text-on-brand)',
      fontSize: 12,
      lineHeight: 1
    }
  }, '✓') : null), label ? React.createElement('span', {
    style: {
      fontSize: 'var(--text-base)',
      color: 'var(--text-primary)'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function IconButton({
  icon,
  size = 'md',
  variant = 'ghost',
  active = false,
  disabled = false,
  onClick,
  label
}) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 48 : 40;
  const [hover, setHover] = React.useState(false);
  const bg = disabled ? 'transparent' : active ? 'var(--brand-soft-bg)' : hover ? 'var(--bg-hover)' : variant === 'solid' ? 'var(--bg-surface-raised)' : 'transparent';
  const fg = disabled ? 'var(--text-disabled)' : active ? 'var(--brand-soft-fg)' : 'var(--text-secondary)';
  return React.createElement('button', {
    'aria-label': label,
    disabled,
    onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: dim,
      height: dim,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: bg,
      color: fg,
      border: variant === 'solid' ? '1px solid var(--border-default)' : '1px solid transparent',
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background .12s ease'
    }
  }, icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  prefix,
  error,
  disabled,
  size = 'md'
}) {
  const h = size === 'sm' ? 32 : 40;
  const [focus, setFocus] = React.useState(false);
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      width: '100%'
    }
  }, label ? React.createElement('label', {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-secondary)'
    }
  }, label) : null, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: h,
      padding: '0 12px',
      background: 'var(--bg-surface-raised)',
      border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--brand)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focus ? 'var(--shadow-focus)' : 'none',
      opacity: disabled ? .5 : 1,
      transition: 'border-color .12s ease'
    }
  }, prefix ? React.createElement('span', {
    style: {
      color: 'var(--text-tertiary)',
      display: 'flex'
    }
  }, prefix) : null, React.createElement('input', {
    type,
    value,
    placeholder,
    disabled,
    onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      width: '100%'
    }
  })), error ? React.createElement('span', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--danger)'
    }
  }, error) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function Select({
  label,
  value,
  options = [],
  onChange,
  size = 'md'
}) {
  const h = size === 'sm' ? 32 : 40;
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, label ? React.createElement('label', {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-secondary)'
    }
  }, label) : null, React.createElement('div', {
    style: {
      position: 'relative',
      height: h
    }
  }, React.createElement('select', {
    value,
    onChange,
    style: {
      appearance: 'none',
      width: '100%',
      height: '100%',
      padding: '0 32px 0 12px',
      background: 'var(--bg-surface-raised)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      cursor: 'pointer'
    }
  }, options.map(o => React.createElement('option', {
    key: o.value,
    value: o.value
  }, o.label))), React.createElement('span', {
    style: {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      color: 'var(--text-tertiary)',
      fontSize: 10
    }
  }, '▼')));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
function Switch({
  checked,
  onChange,
  disabled,
  label
}) {
  return React.createElement('label', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1
    }
  }, React.createElement('span', {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 38,
      height: 22,
      borderRadius: 'var(--radius-full)',
      background: checked ? 'var(--brand)' : 'var(--neutral-300)',
      position: 'relative',
      transition: 'background .15s ease',
      flexShrink: 0
    }
  }, React.createElement('span', {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 18 : 2,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: '#fff',
      transition: 'left .15s ease'
    }
  })), label ? React.createElement('span', {
    style: {
      fontSize: 'var(--text-base)',
      color: 'var(--text-primary)'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function Tag({
  children,
  tone = 'neutral',
  onRemove
}) {
  const tones = {
    neutral: {
      bg: 'var(--bg-surface-raised)',
      fg: 'var(--text-secondary)',
      border: 'var(--border-default)'
    },
    brand: {
      bg: 'var(--brand-soft-bg)',
      fg: 'var(--brand-soft-fg)',
      border: 'transparent'
    }
  };
  const t = tones[tone] || tones.neutral;
  return React.createElement('span', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 26,
      padding: '0 10px',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      background: t.bg,
      color: t.fg,
      border: `1px solid ${t.border}`
    }
  }, children, onRemove ? React.createElement('button', {
    onClick: onRemove,
    style: {
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      padding: 0,
      fontSize: 14,
      lineHeight: 1,
      opacity: .7
    }
  }, '×') : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/domain/KanbanColumn.jsx
try { (() => {
function KanbanColumn({
  title,
  status,
  count,
  children
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minWidth: 280,
      width: 280,
      flexShrink: 0
    }
  }, React.createElement('div', {
    className: `status-${status}`,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 4px'
    }
  }, React.createElement('span', {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--status-fg)'
    }
  }), React.createElement('span', {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)',
      textTransform: 'uppercase',
      letterSpacing: '.03em'
    }
  }, title), React.createElement('span', {
    className: 'font-mono-tabular',
    style: {
      marginLeft: 'auto',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-tertiary)'
    }
  }, count)), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      overflowY: 'auto'
    }
  }, children));
}
Object.assign(__ds_scope, { KanbanColumn });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/KanbanColumn.jsx", error: String((e && e.message) || e) }); }

// components/domain/OrderCard.jsx
try { (() => {
function OrderCard({
  id,
  customer,
  items = [],
  total,
  status,
  time,
  channel,
  onClick
}) {
  return React.createElement('div', {
    onClick,
    style: {
      background: 'var(--bg-surface-raised)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      cursor: onClick ? 'pointer' : 'default'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, React.createElement('div', null, React.createElement('div', {
    className: 'font-mono-tabular',
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)'
    }
  }, '#', id), React.createElement('div', {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)',
      marginTop: 2
    }
  }, customer)), React.createElement('span', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)',
      fontFamily: 'var(--font-mono)'
    }
  }, time)), React.createElement('div', {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-tertiary)',
      lineHeight: 1.5
    }
  }, items.map((it, i) => React.createElement('div', {
    key: i
  }, it.qty, 'x ', it.name))), React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      borderTop: '1px solid var(--border-subtle)'
    }
  }, React.createElement('span', {
    className: 'font-mono-tabular',
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)'
    }
  }, total), React.createElement('span', {
    className: `status-${status}`,
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--status-fg)',
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.createElement('span', {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--status-fg)'
    }
  }), channel)));
}
Object.assign(__ds_scope, { OrderCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/OrderCard.jsx", error: String((e && e.message) || e) }); }

// components/domain/StatusBadge.jsx
try { (() => {
const labels = {
  pending: 'Pendente',
  accepted: 'Aceito',
  preparing: 'Preparando',
  ready: 'Pronto',
  delivering: 'Saiu p/ entrega',
  completed: 'Concluído',
  cancelled: 'Cancelado'
};
function StatusBadge({
  status,
  size = 'md'
}) {
  const pad = size === 'sm' ? '3px 9px' : '5px 12px';
  const fs = size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)';
  return React.createElement('span', {
    className: `status-${status}`,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: pad,
      borderRadius: 'var(--radius-full)',
      fontSize: fs,
      fontWeight: 'var(--weight-semibold)',
      background: 'var(--status-bg)',
      color: 'var(--status-fg)',
      whiteSpace: 'nowrap'
    }
  }, React.createElement('span', {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--status-fg)',
      flexShrink: 0
    }
  }), labels[status] || status);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open,
  title,
  children,
  onClose,
  actions
}) {
  if (!open) return null;
  return React.createElement('div', {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-overlay)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }
  }, React.createElement('div', {
    style: {
      width: 420,
      background: 'var(--bg-surface-raised)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      padding: 24
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, React.createElement('h3', {
    style: {
      margin: 0,
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)'
    }
  }, title), React.createElement('button', {
    onClick: onClose,
    style: {
      border: 'none',
      background: 'transparent',
      color: 'var(--text-tertiary)',
      fontSize: 18,
      cursor: 'pointer'
    }
  }, '×')), React.createElement('div', {
    style: {
      fontSize: 'var(--text-base)',
      color: 'var(--text-secondary)',
      marginBottom: 20
    }
  }, children), actions ? React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    }
  }, actions) : null));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const tones = {
  info: {
    fg: 'var(--text-primary)',
    accent: 'var(--text-tertiary)'
  },
  success: {
    fg: 'var(--status-completed-h)',
    accent: 'var(--status-completed-h)'
  },
  danger: {
    fg: 'var(--danger)',
    accent: 'var(--danger)'
  }
};
function Toast({
  tone = 'info',
  title,
  description,
  onClose
}) {
  const t = tones[tone] || tones.info;
  return React.createElement('div', {
    style: {
      display: 'flex',
      gap: 12,
      width: 340,
      padding: 14,
      background: 'var(--bg-surface-raised)',
      border: '1px solid var(--border-default)',
      borderLeft: `3px solid ${t.accent}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)'
    }
  }, React.createElement('div', {
    style: {
      flex: 1
    }
  }, React.createElement('div', {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-semibold)',
      color: t.fg
    }
  }, title), description ? React.createElement('div', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)',
      marginTop: 2
    }
  }, description) : null), onClose ? React.createElement('button', {
    onClick: onClose,
    style: {
      border: 'none',
      background: 'transparent',
      color: 'var(--text-tertiary)',
      cursor: 'pointer',
      fontSize: 14
    }
  }, '×') : null);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  children
}) {
  const [show, setShow] = React.useState(false);
  return React.createElement('span', {
    style: {
      position: 'relative',
      display: 'inline-flex'
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show ? React.createElement('span', {
    style: {
      position: 'absolute',
      bottom: 'calc(100% + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--neutral-900)',
      color: 'var(--neutral-0)',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-medium)',
      padding: '6px 10px',
      borderRadius: 'var(--radius-sm)',
      whiteSpace: 'nowrap',
      boxShadow: 'var(--shadow-md)',
      zIndex: 20
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/navigation/BranchSelector.jsx
try { (() => {
function BranchSelector({
  branches = [],
  activeId,
  onSelect
}) {
  const [open, setOpen] = React.useState(false);
  const active = branches.find(b => b.id === activeId) || branches[0];
  return React.createElement('div', {
    style: {
      position: 'relative',
      fontFamily: 'var(--font-sans)'
    }
  }, React.createElement('button', {
    onClick: () => setOpen(o => !o),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      height: 40,
      padding: '0 12px 0 14px',
      background: 'var(--bg-surface-raised)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      color: 'var(--text-primary)'
    }
  }, React.createElement('span', {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--status-completed-h)',
      flexShrink: 0
    }
  }), React.createElement('span', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      lineHeight: 1.15
    }
  }, React.createElement('span', {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-semibold)'
    }
  }, active ? active.name : 'Selecionar filial'), React.createElement('span', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)'
    }
  }, active ? active.address : '')), React.createElement('span', {
    style: {
      color: 'var(--text-tertiary)',
      fontSize: 10,
      marginLeft: 4
    }
  }, '▼')), open ? React.createElement('div', {
    style: {
      position: 'absolute',
      top: 'calc(100% + 6px)',
      left: 0,
      minWidth: 240,
      background: 'var(--bg-surface-raised)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
      zIndex: 10
    }
  }, branches.map(b => React.createElement('div', {
    key: b.id,
    onClick: () => {
      onSelect && onSelect(b.id);
      setOpen(false);
    },
    style: {
      padding: '10px 14px',
      cursor: 'pointer',
      background: b.id === activeId ? 'var(--brand-soft-bg)' : 'transparent',
      color: b.id === activeId ? 'var(--brand-soft-fg)' : 'var(--text-primary)'
    }
  }, React.createElement('div', {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-semibold)'
    }
  }, b.name), React.createElement('div', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)'
    }
  }, b.address)))) : null);
}
Object.assign(__ds_scope, { BranchSelector });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/BranchSelector.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
function Sidebar({
  items = [],
  activeId,
  onSelect,
  collapsed = false,
  storeName = 'Rapidex'
}) {
  return React.createElement('div', {
    style: {
      width: collapsed ? 72 : 240,
      height: '100%',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 12px',
      gap: 4,
      transition: 'width .15s ease'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '4px 8px 20px'
    }
  }, React.createElement('img', {
    src: '../../assets/logo-mark.png',
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      flexShrink: 0
    }
  }), !collapsed ? React.createElement('span', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--weight-extrabold)',
      fontSize: 'var(--text-md)',
      color: 'var(--text-primary)'
    }
  }, storeName) : null), items.map(it => {
    const isActive = it.id === activeId;
    return React.createElement('div', {
      key: it.id,
      onClick: () => onSelect && onSelect(it.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
        background: isActive ? 'var(--brand-soft-bg)' : 'transparent',
        fontWeight: isActive ? 'var(--weight-semibold)' : 'var(--weight-medium)',
        fontSize: 'var(--text-base)'
      }
    }, React.createElement('span', {
      style: {
        width: 20,
        height: 20,
        display: 'flex',
        flexShrink: 0
      }
    }, it.icon), !collapsed ? React.createElement('span', null, it.label) : null, !collapsed && it.badge ? React.createElement('span', {
      style: {
        marginLeft: 'auto',
        background: 'var(--status-pending-h)',
        color: '#1A1200',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-bold)',
        borderRadius: 'var(--radius-full)',
        padding: '1px 7px'
      }
    }, it.badge) : null);
  }));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items = [],
  activeId,
  onSelect
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, items.map(it => {
    const isActive = it.id === activeId;
    return React.createElement('button', {
      key: it.id,
      onClick: () => onSelect && onSelect(it.id),
      style: {
        padding: '10px 4px',
        marginRight: 20,
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
        color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-base)',
        fontWeight: isActive ? 'var(--weight-semibold)' : 'var(--weight-medium)',
        cursor: 'pointer'
      }
    }, it.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/painel-lojista/CardapioScreen.jsx
try { (() => {
function CardapioScreen() {
  const {
    Switch,
    IconButton,
    Button,
    Input
  } = window.RapidexDesignSystem_c214e0;
  const {
    edit,
    plus,
    search
  } = window.Icons;
  const [menu, setMenu] = React.useState(window.MOCK_DATA.menu);
  function toggle(catIdx, itemId) {
    setMenu(m => m.map((c, i) => i !== catIdx ? c : {
      ...c,
      items: c.items.map(it => it.id === itemId ? {
        ...it,
        available: !it.available
      } : it)
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: 64,
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 800,
      color: 'var(--text-primary)'
    }
  }, "Card\xE1pio"), /*#__PURE__*/React.createElement(Button, {
    icon: React.createElement(plus, {})
  }, "Novo item")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 24px 0'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Buscar item do card\xE1pio",
    prefix: React.createElement(search, {})
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 28
    }
  }, menu.map((cat, ci) => /*#__PURE__*/React.createElement("div", {
    key: cat.category
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 700,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '.04em',
      marginBottom: 10
    }
  }, cat.category), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, cat.items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 4px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 10,
      background: 'var(--bg-surface-raised)',
      border: '1px solid var(--border-default)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 'var(--text-base)',
      fontWeight: 600,
      color: it.available ? 'var(--text-primary)' : 'var(--text-disabled)'
    }
  }, it.name), /*#__PURE__*/React.createElement("div", {
    className: "font-mono-tabular",
    style: {
      fontSize: 'var(--text-base)',
      color: it.available ? 'var(--text-secondary)' : 'var(--text-disabled)',
      width: 90
    }
  }, it.price), /*#__PURE__*/React.createElement(Switch, {
    checked: it.available,
    onChange: () => toggle(ci, it.id)
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: React.createElement(edit, {}),
    label: "Editar"
  }))))))));
}
window.CardapioScreen = CardapioScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/painel-lojista/CardapioScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/painel-lojista/ConfiguracoesScreen.jsx
try { (() => {
function ConfiguracoesScreen() {
  const {
    Tabs,
    Switch,
    Input,
    Checkbox,
    Card,
    Button
  } = window.RapidexDesignSystem_c214e0;
  const [tab, setTab] = React.useState('geral');
  const [open, setOpen] = React.useState(true);
  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 800,
      color: 'var(--text-primary)'
    }
  }, "Configura\xE7\xF5es")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    items: [{
      id: 'geral',
      label: 'Geral'
    }, {
      id: 'horarios',
      label: 'Horários'
    }, {
      id: 'pagamentos',
      label: 'Pagamentos'
    }],
    activeId: tab,
    onSelect: setTab
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 24,
      maxWidth: 520
    }
  }, tab === 'geral' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Switch, {
    checked: open,
    onChange: setOpen,
    label: "Loja aberta para pedidos"
  })), /*#__PURE__*/React.createElement(Input, {
    label: "Nome da loja",
    value: "Rapidex Burger \u2014 Centro"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Tempo m\xE9dio de preparo (min)",
    value: "25"
  })) : null, tab === 'horarios' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, dias.map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '10px 4px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 90,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)'
    }
  }, d), /*#__PURE__*/React.createElement(Input, {
    size: "sm",
    value: "18:00"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-tertiary)'
    }
  }, "\u2014"), /*#__PURE__*/React.createElement(Input, {
    size: "sm",
    value: "23:30"
  })))) : null, tab === 'pagamentos' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: true,
    label: "Pix"
  }), /*#__PURE__*/React.createElement(Checkbox, {
    checked: true,
    label: "Cart\xE3o de cr\xE9dito na entrega"
  }), /*#__PURE__*/React.createElement(Checkbox, {
    checked: true,
    label: "Cart\xE3o de d\xE9bito na entrega"
  }), /*#__PURE__*/React.createElement(Checkbox, {
    checked: false,
    label: "Dinheiro"
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Button, null, "Salvar altera\xE7\xF5es"))));
}
window.ConfiguracoesScreen = ConfiguracoesScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/painel-lojista/ConfiguracoesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/painel-lojista/Icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const Icons = {
  orders: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M4 6h16M4 12h16M4 18h7"
  })),
  menu: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M4 19h16M4 5h16M9 5v14M15 5v14"
  })),
  kitchen: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M4 4h16v16H4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 10h16"
  })),
  settings: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5-2 2m-9 9-2 2m13-2-2-2m-9-9-2-2"
  })),
  bell: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.7 21a2 2 0 0 1-3.4 0"
  })),
  search: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.3-4.3"
  })),
  plus: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  })),
  print: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"
  })),
  clock: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v5l3 3"
  })),
  edit: p => /*#__PURE__*/React.createElement("svg", _extends({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 20h9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
  }))
};
window.Icons = Icons;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/painel-lojista/Icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/painel-lojista/KanbanScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function KanbanScreen() {
  const {
    KanbanColumn,
    OrderCard,
    Dialog,
    Button,
    IconButton
  } = window.RapidexDesignSystem_c214e0;
  const {
    clock,
    print
  } = window.Icons;
  const [orders, setOrders] = React.useState(window.MOCK_DATA.orders);
  const [selected, setSelected] = React.useState(null);
  const stages = [{
    status: 'pending',
    title: 'Pendente'
  }, {
    status: 'accepted',
    title: 'Aceito'
  }, {
    status: 'preparing',
    title: 'Preparando'
  }, {
    status: 'ready',
    title: 'Pronto'
  }, {
    status: 'delivering',
    title: 'Saiu p/ entrega'
  }, {
    status: 'completed',
    title: 'Concluído'
  }, {
    status: 'cancelled',
    title: 'Cancelado'
  }];
  const order = orders.find(o => o.id === selected);
  const flow = ['pending', 'accepted', 'preparing', 'ready', 'delivering', 'completed'];
  function advance() {
    setOrders(os => os.map(o => {
      if (o.id !== selected) return o;
      const idx = flow.indexOf(o.status);
      return idx >= 0 && idx < flow.length - 1 ? {
        ...o,
        status: flow[idx + 1]
      } : o;
    }));
    setSelected(null);
  }
  function cancel() {
    setOrders(os => os.map(o => o.id === selected ? {
      ...o,
      status: 'cancelled'
    } : o));
    setSelected(null);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: 64,
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 800,
      color: 'var(--text-primary)'
    }
  }, "Pedidos"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-tertiary)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement(clock, {}), "Atualizado em tempo real")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: React.createElement(print, {}),
    label: "Imprimir",
    variant: "solid"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "Filtrar"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      gap: 16,
      padding: 20,
      overflowX: 'auto'
    }
  }, stages.map(s => {
    const col = orders.filter(o => o.status === s.status);
    return /*#__PURE__*/React.createElement(KanbanColumn, {
      key: s.status,
      title: s.title,
      status: s.status,
      count: col.length
    }, col.map(o => /*#__PURE__*/React.createElement(OrderCard, _extends({
      key: o.id
    }, o, {
      onClick: () => setSelected(o.id)
    }))), col.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--text-sm)',
        color: 'var(--text-disabled)',
        padding: '8px 4px'
      }
    }, "Nenhum pedido") : null);
  })), /*#__PURE__*/React.createElement(Dialog, {
    open: !!order,
    title: order ? `Pedido #${order.id}` : '',
    onClose: () => setSelected(null),
    actions: order && order.status !== 'completed' && order.status !== 'cancelled' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      onClick: cancel
    }, "Cancelar pedido"), /*#__PURE__*/React.createElement(Button, {
      onClick: advance
    }, "Avan\xE7ar status")) : /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: () => setSelected(null)
    }, "Fechar")
  }, order ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)',
      marginBottom: 10
    }
  }, order.customer, " \xB7 ", order.channel, " \xB7 ", order.time), order.items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-primary)'
    }
  }, it.qty, "x ", it.name)), /*#__PURE__*/React.createElement("div", {
    className: "font-mono-tabular",
    style: {
      marginTop: 10,
      fontSize: 'var(--text-lg)',
      fontWeight: 700,
      color: 'var(--text-primary)'
    }
  }, order.total)) : null));
}
window.KanbanScreen = KanbanScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/painel-lojista/KanbanScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/painel-lojista/data.js
try { (() => {
window.MOCK_DATA = {
  branches: [{
    id: 'centro',
    name: 'Loja Centro',
    address: 'Rua das Flores, 123'
  }, {
    id: 'norte',
    name: 'Loja Zona Norte',
    address: 'Av. Brasil, 900'
  }],
  orders: [{
    id: '1042',
    customer: 'Maria Silva',
    items: [{
      qty: 2,
      name: 'X-Burger Clássico'
    }, {
      qty: 1,
      name: 'Coca-Cola 350ml'
    }],
    total: 'R$ 47,80',
    status: 'pending',
    time: '18:42',
    channel: 'Delivery'
  }, {
    id: '1041',
    customer: 'Carlos Nunes',
    items: [{
      qty: 1,
      name: 'Combo Família'
    }],
    total: 'R$ 89,90',
    status: 'pending',
    time: '18:40',
    channel: 'Delivery'
  }, {
    id: '1039',
    customer: 'João Souza',
    items: [{
      qty: 1,
      name: 'Combo Duplo'
    }, {
      qty: 1,
      name: 'Batata frita M'
    }],
    total: 'R$ 62,00',
    status: 'accepted',
    time: '18:35',
    channel: 'Balcão'
  }, {
    id: '1037',
    customer: 'Ana Lima',
    items: [{
      qty: 3,
      name: 'Batata frita G'
    }],
    total: 'R$ 39,90',
    status: 'preparing',
    time: '18:28',
    channel: 'Delivery'
  }, {
    id: '1035',
    customer: 'Pedro Alves',
    items: [{
      qty: 2,
      name: 'X-Salada'
    }, {
      qty: 2,
      name: 'Suco natural'
    }],
    total: 'R$ 58,40',
    status: 'preparing',
    time: '18:20',
    channel: 'App'
  }, {
    id: '1033',
    customer: 'Fernanda Dias',
    items: [{
      qty: 1,
      name: 'Pizza Broto Calabresa'
    }],
    total: 'R$ 34,00',
    status: 'ready',
    time: '18:12',
    channel: 'Balcão'
  }, {
    id: '1030',
    customer: 'Lucas Rocha',
    items: [{
      qty: 1,
      name: 'Combo Família'
    }],
    total: 'R$ 89,90',
    status: 'delivering',
    time: '17:55',
    channel: 'Delivery'
  }, {
    id: '1029',
    customer: 'Beatriz Melo',
    items: [{
      qty: 2,
      name: 'X-Bacon'
    }],
    total: 'R$ 51,80',
    status: 'completed',
    time: '17:40',
    channel: 'Delivery'
  }, {
    id: '1028',
    customer: 'Rafael Costa',
    items: [{
      qty: 1,
      name: 'X-Burger Clássico'
    }],
    total: 'R$ 24,90',
    status: 'completed',
    time: '17:32',
    channel: 'Balcão'
  }, {
    id: '1025',
    customer: 'Camila Rezende',
    items: [{
      qty: 1,
      name: 'Combo Duplo'
    }],
    total: 'R$ 45,00',
    status: 'cancelled',
    time: '17:10',
    channel: 'App'
  }],
  menu: [{
    category: 'Lanches',
    items: [{
      id: 1,
      name: 'X-Burger Clássico',
      price: 'R$ 24,90',
      available: true
    }, {
      id: 2,
      name: 'X-Bacon',
      price: 'R$ 27,90',
      available: true
    }, {
      id: 3,
      name: 'X-Salada',
      price: 'R$ 26,50',
      available: true
    }, {
      id: 4,
      name: 'Combo Duplo',
      price: 'R$ 45,00',
      available: false
    }]
  }, {
    category: 'Acompanhamentos',
    items: [{
      id: 5,
      name: 'Batata frita M',
      price: 'R$ 14,90',
      available: true
    }, {
      id: 6,
      name: 'Batata frita G',
      price: 'R$ 19,90',
      available: true
    }]
  }, {
    category: 'Bebidas',
    items: [{
      id: 7,
      name: 'Coca-Cola 350ml',
      price: 'R$ 7,50',
      available: true
    }, {
      id: 8,
      name: 'Suco natural',
      price: 'R$ 9,90',
      available: true
    }]
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/painel-lojista/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.KanbanColumn = __ds_scope.KanbanColumn;

__ds_ns.OrderCard = __ds_scope.OrderCard;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.BranchSelector = __ds_scope.BranchSelector;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
