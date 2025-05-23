export default async function Home() {
  const serverTime: string = new globalThis.Date().toISOString();
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <h1 className="text-6xl font-bold text-gray-900 mb-6">
        Hello, World
      </h1>
      <p className="text-xl text-gray-700">
        Page rendered at: {serverTime}
      </p>
    </main>
  );
}