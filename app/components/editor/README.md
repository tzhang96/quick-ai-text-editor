# Editor Component Refactoring

This directory contains the refactored components for the text editor. The original monolithic `Editor.tsx` component has been broken down into smaller, more maintainable pieces.

## Directory Structure

- `/core` - Core editor components
- `/extensions` - Custom Tiptap extensions
- `/hooks` - Custom React hooks for editor functionality
- `/ui` - UI components for the editor

## Components

### Extensions

- `PersistentHighlight.tsx` - A custom Tiptap extension for persistent text highlighting

### Hooks

- `useActionHistory.ts` - Hook for managing action history
- `useEditorInitialization.ts` - Hook for initializing the editor with extensions
- `useExportMenu.ts` - Hook for managing export functionality
- `useModelSelection.ts` - Hook for managing model selection
- `useSelectionHandling.ts` - Hook for handling text selection
- `useTextChangeTracking.ts` - Hook for tracking text changes

### UI Components

- `ExportMenu.tsx` - Menu for exporting content in different formats
- `ModelSelector.tsx` - Component for selecting AI models

## Types

Types have been moved to `/app/types/editor.types.ts` for better organization.

## Utilities

Utility functions have been moved to:
- `/app/utils/highlightUtils.ts` - Utilities for managing highlights
- `/app/utils/selectionUtils.ts` - Utilities for handling text selection

## Usage

The refactored components can be used to build a more maintainable and extensible editor. The next step is to create a new `EditorContainer.tsx` component that uses these refactored pieces. 