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
