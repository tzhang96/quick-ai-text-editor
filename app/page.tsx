import Editor from './components/Editor';

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 lg:p-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">AI-Enhanced Text Editor</h1>
        <p className="text-gray-600 mt-2">
          A rich text editor with AI capabilities powered by Google Gemini
        </p>
      </header>
      
      <Editor />
    </main>
  );
}
