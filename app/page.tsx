import EmergencyCoach from "@/components/EmergencyCoach";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Safety Disclaimer Banner */}
      <div className="bg-amber-500 text-amber-950 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-start gap-3">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div className="text-sm">
            <p className="font-bold">Important Safety Notice</p>
            <p className="mt-1">
              LifeLine is <strong>NOT</strong> a doctor, paramedic, or emergency
              medical service. This is an AI assistant designed to provide
              general guidance only.{" "}
              <strong>
                Always call your local emergency number (911 in the US) for
                immediate medical emergencies.
              </strong>{" "}
              Do not delay calling emergency services while using this app.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-4 py-12">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-lg shadow-red-500/30 mb-6">
            <span className="text-4xl">🆘</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            LifeLine
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Voice-first emergency coaching assistant. Speak naturally and
            receive real-time guidance during stressful situations.
          </p>
        </div>

        {/* Emergency Coach Card */}
        <EmergencyCoach />

        {/* Info Cards */}
        <div className="max-w-4xl mx-auto mt-16 grid md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🎙️</span>
            </div>
            <h3 className="text-white font-semibold mb-2">Voice-First</h3>
            <p className="text-slate-400 text-sm">
              Just speak naturally. The AI listens and responds with real-time
              audio guidance.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
              <span className="text-2xl">💡</span>
            </div>
            <h3 className="text-white font-semibold mb-2">Step-by-Step</h3>
            <p className="text-slate-400 text-sm">
              Receive clear, actionable guidance tailored to your specific
              situation.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
              <span className="text-2xl">📞</span>
            </div>
            <h3 className="text-white font-semibold mb-2">Contact Support</h3>
            <p className="text-slate-400 text-sm">
              The assistant can trigger calls to your emergency contacts when
              needed.
            </p>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <footer className="max-w-4xl mx-auto mt-16 text-center">
          <div className="border-t border-slate-700 pt-8">
            <p className="text-slate-500 text-xs max-w-2xl mx-auto">
              LifeLine Emergency Voice Coach is for informational and
              educational purposes only. It is not intended to be a substitute
              for professional medical advice, diagnosis, or treatment. Never
              disregard professional medical advice or delay in seeking it
              because of something you have heard from this application. If you
              think you may have a medical emergency, call your doctor or
              emergency services immediately.
            </p>
            <p className="text-slate-600 text-xs mt-4">
              © {new Date().getFullYear()} LifeLine · Demo/Testing Only
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
