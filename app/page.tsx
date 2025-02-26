import EditorContainer from './components/editor/core/EditorContainer';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="container mx-auto max-w-5xl">
        <header className="max-w-4xl mx-auto mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
            AI-Enhanced Text Editor
          </h1>
          <p className="text-gray-600 md:text-lg max-w-2xl mx-auto">
            A super cool text editor with AI capabilities powered by Google Gemini
          </p>
        </header>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <EditorContainer />
        </div>
        
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>Select text to use AI actions • <span className="text-indigo-500">Expand</span> • <span className="text-green-500">Summarize</span> • <span className="text-yellow-600">Rephrase</span> • <span className="text-purple-500">Revise</span></p>
          <p className="mt-2">Keyboard shortcuts: Ctrl+E (Export), Ctrl+M (Model), Ctrl+H (History)</p>
        </footer>
      </div>
    </main>
  );
}
