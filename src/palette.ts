export const COLORS = [
  { id: 'moss', label: 'Moss', value: '#3f6b4e' },
  { id: 'rust', label: 'Rust', value: '#b55233' },
  { id: 'ink', label: 'Ink', value: '#3c5278' },
  { id: 'amber', label: 'Amber', value: '#a56b22' },
  { id: 'plum', label: 'Plum', value: '#7a4968' },
  { id: 'teal', label: 'Teal', value: '#2d6a66' },
  { id: 'clay', label: 'Clay', value: '#8d5a3c' },
  { id: 'slate', label: 'Slate', value: '#4e5d68' },
] as const;

export type ColorId = (typeof COLORS)[number]['id'];

export function colorById(id: string): (typeof COLORS)[number] {
  return COLORS.find((color) => color.id === id) ?? COLORS[0];
}
