/**
 * Font options for per-project font customization
 *
 * These are system fonts (no bundled @fontsource packages required).
 * Users must have the fonts installed on their system for them to work.
 */

// Sentinel value for "use default font" - Radix Select doesn't allow empty strings
export const DEFAULT_FONT_VALUE = 'default';

export interface UIFontOption {
  value: string; // CSS font-family value ('default' means "use default")
  label: string; // Display label for the dropdown
}

/**
 * Sans/UI fonts for headings, labels, and general text
 *
 * 'default' value means "use the theme default" (Geist Sans for all themes)
 */
export const UI_SANS_FONT_OPTIONS: readonly UIFontOption[] = [
  { value: DEFAULT_FONT_VALUE, label: 'Default (Geist Sans)' },
  { value: "'Inter', system-ui, sans-serif", label: 'Inter' },
  { value: "'SF Pro', system-ui, sans-serif", label: 'SF Pro' },
  { value: "'Source Sans 3', system-ui, sans-serif", label: 'Source Sans' },
  { value: "'IBM Plex Sans', system-ui, sans-serif", label: 'IBM Plex Sans' },
  { value: "'Roboto', system-ui, sans-serif", label: 'Roboto' },
  { value: 'system-ui, sans-serif', label: 'System Default' },
] as const;

/**
 * Mono/code fonts for code blocks, terminals, and monospaced text
 *
 * 'default' value means "use the theme default" (Geist Mono for all themes)
 */
export const UI_MONO_FONT_OPTIONS: readonly UIFontOption[] = [
  { value: DEFAULT_FONT_VALUE, label: 'Default (Geist Mono)' },
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
  { value: "'Fira Code', monospace", label: 'Fira Code' },
  { value: "'SF Mono', Menlo, Monaco, monospace", label: 'SF Mono' },
  { value: "'Source Code Pro', monospace", label: 'Source Code Pro' },
  { value: "'IBM Plex Mono', monospace", label: 'IBM Plex Mono' },
  { value: "Menlo, Monaco, 'Courier New', monospace", label: 'Menlo / Monaco' },
  { value: "'Cascadia Code', monospace", label: 'Cascadia Code' },
] as const;

/**
 * Get the display label for a font value
 */
export function getFontLabel(
  fontValue: string | undefined,
  options: readonly UIFontOption[]
): string {
  if (!fontValue || fontValue === DEFAULT_FONT_VALUE) return options[0].label;
  const option = options.find((o) => o.value === fontValue);
  return option?.label ?? fontValue;
}
