/**
 * Public API of the `toggle-color-mode` feature. The mode itself is held by the
 * app (`app/providers/ColorModeProvider`) and read through `shared/theme`'s
 * context; this feature is the control that flips it.
 */
export { ToggleColorModeButton } from "./ui/ToggleColorModeButton";
