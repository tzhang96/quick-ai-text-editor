# AI-Enhanced Text Editor

A super cool rich text editor with AI capabilities powered by Google Gemini. This application allows you to write and format text, and then use AI to transform selected text in various ways, such as expanding, summarizing, rephrasing, or revising.

## Features

- **Rich Text Editing**: Format text with bold, italic, underline, headings, and lists
- **Keyboard Shortcuts**: Standard shortcuts for formatting and editing
- **AI-Powered Text Transformations**:
  - **Expand**: Add more details and context to selected text
  - **Summarize**: Create a concise summary of selected text
  - **Rephrase**: Reword text while maintaining the original meaning
  - **Revise**: Improve clarity and readability of selected text
- **Custom Instructions**: Add specific instructions to guide the AI transformations
- **Edit History**: View a complete log of all AI transformations made
- **Improved UI Experience**:
  - **Persistent Popup**: Text selection popup stays open after actions for easy multi-step editing
  - **Font Toggle**: Switch between regular and monospace fonts with Ctrl+` shortcut
  - **Smart Copy/Cut**: Preserves formatting when copying selected text, copies whole document when nothing selected
  - **Action History**: Remembers additional instructions for each action for easy reuse
  - **Export Options**: Download your work in various formats (HTML, Markdown, plain text)

## Getting Started

### Prerequisites

- Node.js 18.x or later
- NPM or Yarn
- Google Gemini API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/quick-ai-text-editor.git
   cd quick-ai-text-editor
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the root directory with your Google Gemini API key:
   ```
   NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY=your_api_key_here
   NEXT_PUBLIC_WORD_LIMIT=2500
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to use the application.

## How to Use

1. **Write or paste text** in the editor.
2. **Format text** using the toolbar buttons or keyboard shortcuts:
   - **Bold**: Ctrl+B
   - **Italic**: Ctrl+I
   - **Underline**: Ctrl+U
   - **Headings**: Ctrl+Alt+[1-3]
   - **Lists**: Ctrl+Shift+7 (ordered) or Ctrl+Shift+8 (unordered)
   - **Undo/Redo**: Ctrl+Z / Ctrl+Y
   - **Toggle Font**: Ctrl+` (switches between regular and monospace font)

3. **Use AI transformations**:
   - Select the text you want to modify
   - Click on the "AI Actions" button that appears above the selection
   - Choose from Expand, Summarize, Rephrase, or Revise
   - Optionally add additional instructions to guide the AI
   - Click the action button to apply the transformation
   - The popup remains open after transformation, ready for further actions on the same text
   - Additional instructions are cleared after each action for a clean slate

4. **Copy and Cut operations**:
   - Select text and press Ctrl+C to copy just the selected text with formatting preserved
   - Press Ctrl+C without selection to copy the entire document
   - Select text and press Ctrl+X to cut just the selected text
   - Press Ctrl+X without selection to clear the entire document

5. **View edit history**:
   - Click the "History" button at the top of the editor
   - Filter history entries using the search box
   - View original and modified text for each transformation
   - Reapply previous actions with their original instructions

6. **Export your work**:
   - Click the "Export" button in the top-right corner
   - Choose from HTML, Markdown, or plain text formats
   - Files are downloaded directly to your device

7. **Word Limit Management**:
   - The application has a configurable word limit to control API usage
   - Default limit is 2,500 words
   - You can adjust this limit by changing the `NEXT_PUBLIC_WORD_LIMIT` in your `.env.local` file
   - If your document exceeds the word limit, you'll see a warning message when trying to use AI features

## Development

This project uses:

- Next.js for the framework
- TypeScript for type safety
- TipTap for the rich text editor
- Tailwind CSS for styling
- Google Generative AI SDK for AI capabilities

### Project Structure

```
quick-ai-text-editor/
├── app/
│   ├── api/
│   │   └── history/
│   │       └── route.ts      # API routes for edit history
│   │   ├── components/
│   │   │   ├── editor/
│   │   │   │   ├── core/
│   │   │   │   │   └── EditorContainer.tsx  # Main editor container
│   │   │   │   ├── extensions/
│   │   │   │   │   └── PersistentHighlight.tsx  # Custom TipTap extensions
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useEditorInitialization.ts  # Editor setup
│   │   │   │   │   ├── useSelectionHandling.ts     # Text selection  
│   │   │   │   │   └── useActionHistory.ts         # History management
│   │   │   │   └── ui/
│   │   │   │       ├── ExportMenu.tsx        # Export functionality
│   │   │   │       └── ModelSelector.tsx     # AI model selection
│   │   │   ├── EditorMenuBar.tsx             # Formatting toolbar
│   │   │   ├── TextSelectionPopup.tsx        # AI action popup
│   │   │   └── EditHistoryViewer.tsx         # History viewer
│   │   ├── services/
│   │   │   ├── geminiService.ts    # Google Gemini API integration
│   │   │   └── historyService.ts   # Edit history logging
│   │   ├── utils/
│   │   │   ├── highlightUtils.ts   # Text highlighting utilities
│   │   │   └── selectionUtils.ts   # Selection handling utilities
│   │   └── page.tsx                # Main page
│   ├── docs/
│   │   └── planning.md           # Implementation checklist
│   └── public/
└── ...configuration files
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [TipTap](https://tiptap.dev/) for the rich text editor
- [Google Gemini API](https://ai.google.dev/) for AI capabilities
- [Next.js](https://nextjs.org/) for the framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
