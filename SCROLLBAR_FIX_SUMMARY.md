# Scrollbar Fix Summary

## Issues Found

1. **Case Info pane has no scrollbar** - ViewPane body container needs `overflow: auto`
2. **Scrollbar appears white/invisible** - Theme colors use semi-transparent values that don't contrast well

## Solutions

### 1. Add CSS to ensure ViewPane body scrolls
The ViewPane base class doesn't automatically make the body scrollable. We need to add CSS that targets the Case Info pane's body element.

### 2. Update scrollbar colors in themes
The current colors like `#79797933` (50% transparent) don't provide enough contrast. Need more opaque values.

## Implementation Plan

1. Add CSS rule in `void.css` to make Case Info pane body scrollable
2. Update all 12 theme scrollbar colors to be more visible
3. Test across all themes


