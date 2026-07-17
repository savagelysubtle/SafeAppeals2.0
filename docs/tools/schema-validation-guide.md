# Parameter Validation Guide

Validation is handled inline in `src/vs/workbench/contrib/void/browser/tools/toolsService.ts`. There is no separate schema validation class.

## How It Works

- **Per-operation switch cases**: Each tool has its own validation logic in a switch statement
- **Nested validation for `edit_document`**: Operation types (e.g. `set_cell_value`, `insert_chart`) are validated via nested switch cases
- **Checks performed**: Required parameters, type correctness, value constraints

## Validation Pattern

```typescript
// In toolsService.ts - validation is done inline per tool
case 'edit_document': {
  if (!params.uri) throw new Error('uri is required');
  if (!Array.isArray(params.operations)) throw new Error('operations must be an array');
  for (const op of params.operations) {
    switch (op.type) {
      case 'set_cell_value':
        if (!op.sheet) throw new Error('sheet is required');
        if (!op.cell) throw new Error('cell is required');
        break;
      case 'insert_chart':
        if (!op.chart_type) throw new Error('chart_type is required');
        if (!op.data_range) throw new Error('data_range is required');
        break;
      // ... other operations
    }
  }
  break;
}
```

## Adding Validation for New Tools

When adding a new tool, add a corresponding case in the validation switch in `toolsService.ts` with checks for required parameters, types, and any value constraints.
