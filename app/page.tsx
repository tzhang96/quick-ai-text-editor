import Editor from './components/Editor';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 py-12">
        <header className="max-w-4xl mx-auto mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
            AI-Enhanced Text Editor
          </h1>
          <p className="text-gray-600 md:text-lg max-w-2xl mx-auto">
            A super cool text editor with AI capabilities powered by Google Gemini
          </p>
        </header>
        
        <Editor />
        
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>Select text to use AI actions • <span className="text-indigo-500">Expand</span> • <span className="text-green-500">Summarize</span> • <span className="text-yellow-600">Rephrase</span> • <span className="text-purple-500">Revise</span></p>
        </footer>
      </div>
    </main>
  );
}
