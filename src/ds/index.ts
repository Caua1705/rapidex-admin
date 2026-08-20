/**
 * O design system do painel Rapidex.
 *
 * Importe daqui, e não do arquivo de cada componente:
 *
 *   import { Field, Input, Select } from '../ds';
 *
 * Cada componente mora num arquivo próprio, com um exemplo de uso no topo, e
 * todos aparecem juntos na rota `/ui` (só em desenvolvimento), que é a galeria
 * viva — se um estado não está lá, ele não existe.
 */

export { Field, FieldRow } from './Field';
export { useFieldState, type FieldState } from './field-context';
export { Input } from './Input';
export { Textarea } from './Textarea';
export { RangeInput } from './RangeInput';
export { SearchField } from './SearchField';
export { Select, type SelectOption } from './Select';
export { Checkbox } from './Checkbox';
export { RadioGroup, type RadioOption } from './Radio';
export { Switch } from './Switch';
export { Spinner } from './Spinner';
export * from './icons';
export { Tabs, type TabItem } from './Tabs';
export { Breadcrumb, type CrumbItem } from './Breadcrumb';
export { Sheet } from './Sheet';
export { useFocusTrap } from './use-focus-trap';
export { StatusChip } from './StatusChip';
export { Badge } from './Badge';
export { MaturationBar } from './MaturationBar';
export { faixaDe, razaoDeMaturacao, type Faixa } from './maturation';
export { OrderRow } from './OrderRow';
export { PageBar } from './PageBar';
export { Card } from './Card';
export { DataTable, type Column } from './DataTable';
export { STAGE_LABEL, type Stage } from './status';
