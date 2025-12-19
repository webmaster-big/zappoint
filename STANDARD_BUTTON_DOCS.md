# StandardButton Component Documentation

## Overview

The `StandardButton` component is a reusable, themeable button component designed to provide consistent styling across the admin interface. It follows the minimal design pattern established in the analytics components with the base styling of `px-4 py-2 text-sm font-medium rounded-lg transition`.

## Features

- **Theme-aware**: Automatically adapts to the current theme color
- **Multiple variants**: Primary, secondary, danger, success, and ghost styles
- **Flexible sizing**: Small, medium, and large sizes
- **Built-in loading states**: Includes spinner animation
- **Icon support**: Left or right positioned icons from Lucide React
- **Accessibility**: Proper focus states and keyboard navigation
- **TypeScript support**: Full type definitions included

## Props

```typescript
interface StandardButtonProps {
  children: React.ReactNode;           // Button content
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';          // Size variants
  disabled?: boolean;                  // Disable the button
  loading?: boolean;                   // Show loading spinner
  icon?: LucideIcon;                   // Icon component from lucide-react
  iconPosition?: 'left' | 'right';    // Icon placement
  className?: string;                  // Additional CSS classes
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset'; // HTML button type
  fullWidth?: boolean;                 // Make button full width
}
```

## Variants

### Primary (default)
- **Use case**: Main actions, form submissions, confirmations
- **Style**: Theme-colored background with white text
- **Example**: Save, Submit, Confirm buttons

### Secondary
- **Use case**: Alternative actions, cancel buttons
- **Style**: White background with gray border and text
- **Example**: Cancel, Close, Back buttons

### Danger
- **Use case**: Destructive actions
- **Style**: Red background with white text
- **Example**: Delete, Remove, Disconnect buttons

### Success
- **Use case**: Positive confirmations
- **Style**: Green background with white text
- **Example**: Approve, Accept, Connect buttons

### Ghost
- **Use case**: Subtle actions, icon buttons
- **Style**: Transparent background with theme-colored text
- **Example**: Edit, View, Filter buttons

## Sizes

- **sm**: `px-3 py-1.5 text-xs` - Compact buttons for table actions
- **md**: `px-4 py-2 text-sm` - Default size for most use cases
- **lg**: `px-6 py-3 text-base` - Prominent actions and forms

## Usage Examples

### Basic Usage
```jsx
import StandardButton from '../../components/ui/StandardButton';

// Primary button
<StandardButton onClick={handleSave}>
  Save Changes
</StandardButton>

// Secondary button
<StandardButton variant="secondary" onClick={handleCancel}>
  Cancel
</StandardButton>
```

### With Icons
```jsx
import { Download, Trash2, Edit } from 'lucide-react';

// Icon on the left
<StandardButton icon={Download} onClick={handleExport}>
  Export Data
</StandardButton>

// Icon on the right
<StandardButton 
  icon={Edit} 
  iconPosition="right" 
  variant="ghost"
  size="sm"
>
  Edit
</StandardButton>

// Icon only (no text)
<StandardButton 
  icon={Trash2} 
  variant="danger" 
  size="sm" 
  onClick={handleDelete}
/>
```

### Loading States
```jsx
<StandardButton 
  loading={isSubmitting}
  disabled={isSubmitting}
  onClick={handleSubmit}
>
  Submit Form
</StandardButton>
```

### Modal Button Pairs
```jsx
// Common modal button layout
<div className="flex gap-3 pt-4 border-t border-gray-200">
  <StandardButton
    variant="secondary"
    onClick={() => setShowModal(false)}
    fullWidth
  >
    Cancel
  </StandardButton>
  <StandardButton
    variant="primary"
    onClick={handleConfirm}
    fullWidth
    loading={isLoading}
  >
    Confirm
  </StandardButton>
</div>
```

## Migration Guide

### From Old Button Patterns

**Before:**
```jsx
<button
  onClick={handleClick}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
>
  Click Me
</button>
```

**After:**
```jsx
<StandardButton onClick={handleClick}>
  Click Me
</StandardButton>
```

### Common Replacements

| Old Pattern | StandardButton Equivalent |
|-------------|---------------------------|
| `bg-{theme}-600 text-white` | `variant="primary"` (default) |
| `border border-gray-300 text-gray-700` | `variant="secondary"` |
| `bg-red-600 text-white` | `variant="danger"` |
| `bg-green-600 text-white` | `variant="success"` |
| `text-{theme}-600 hover:bg-{theme}-50` | `variant="ghost"` |
| `px-3 py-1.5 text-xs` | `size="sm"` |
| `px-6 py-3 text-base` | `size="lg"` |
| `flex-1` or `w-full` | `fullWidth={true}` |

## Best Practices

### Do ✅
- Use `variant="primary"` for the main action in a group
- Use `variant="secondary"` for cancel/close actions
- Use `variant="danger"` for destructive actions
- Use `fullWidth` for modal button pairs
- Use `size="sm"` for table action buttons
- Use icons for common actions (save, delete, edit, etc.)
- Use loading states for async operations

### Don't ❌
- Mix different button styles in the same interface
- Use multiple primary buttons in the same context
- Forget to add proper loading states for async actions
- Use ghost buttons for important primary actions
- Skip accessibility considerations

## Component Integration Status

### ✅ Completed
- Settings.tsx - All modal buttons updated
- Analytics/LocationManagerAnalytics.tsx - Export buttons updated
- Analytics/CompanyAnalytics.tsx - Export buttons updated

### 🚧 In Progress
- User management modals
- Package management forms
- Attraction creation forms

### ⏳ Planned
- Table action buttons
- Card component buttons
- Form submission buttons

## Accessibility

The StandardButton component includes:
- Proper focus management with `focus:outline-none focus:ring-2`
- Keyboard navigation support
- Screen reader friendly loading states
- Proper contrast ratios for all variants
- Disabled state handling

## Theme Integration

The component automatically uses the current theme color from `useThemeColor()` hook:
- Primary variant uses theme color for background
- Ghost variant uses theme color for text
- Focus rings use theme color for consistency

## Advanced Customization

For special cases where the StandardButton doesn't fit:
```jsx
<StandardButton 
  className="shadow-lg transform hover:scale-105"
  variant="primary"
  size="lg"
>
  Special Button
</StandardButton>
```

## Troubleshooting

### Common Issues

1. **Icons not showing**: Make sure to import the icon from `lucide-react`
2. **Theme colors not applying**: Ensure `useThemeColor` hook is working
3. **Loading state not clearing**: Check that `loading` prop is properly managed in state

### Getting Help

If you encounter issues or need to add new variants:
1. Check existing usage patterns in the codebase
2. Consult this documentation for proper usage
3. Consider if a new variant is needed or if existing ones can be customized