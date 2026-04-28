import Dropzone from "./components/Dropzone";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-4">
            Red-Actor
          </h1>
          <p className="text-lg text-gray-600">
            Securely strip Personally Identifiable Information (PII) from
            resumes before they hit your clients
          </p>
        </div>

        <Dropzone />
      </div>
    </main>
  );
}
