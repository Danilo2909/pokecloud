import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

function Chip({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function PillButton({ children, onClick, disabled, className = "", type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow ${
        disabled ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-pokecloud-600 hover:bg-pokecloud-700 text-white"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Section({ title, icon, children, className = "" }) {
  return (
    <div className={`rounded-3xl border border-pokecloud-100 bg-white p-5 shadow-pcloud ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <div className="text-xl">{icon}</div>
        <h2 className="text-lg font-bold text-pokecloud-700">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const DEFAULT_POKEDATA = ["Pikachu","Bulbasaur","Charmander","Squirtle","Eevee","Jigglypuff","Snorlax","Psyduck","Onix","Mew"];

const QUESTION_BANK = [
  { text: "O que é computação em nuvem (cloud)?", choices: ["Um aplicativo offline instalado no PC","Servidores na internet que fornecem recursos (armazenamento, processamento, apps) sob demanda","Um cabo especial que conecta dois computadores","Um tipo de antivírus empresarial"], correctIndex: 1, tip: "Cloud = recursos via internet, escaláveis e acessíveis em qualquer lugar." },
  { text: "Qual é um exemplo de aplicativo em nuvem?", choices: ["Bloco de Notas do Windows","Google Drive","Calculadora offline","Gerenciador de Dispositivos USB"], correctIndex: 1, tip: "Google Drive/Docs/OneDrive/iCloud/Spotify/YouTube são exemplos comuns." },
  { text: "Vantagem de salvar na nuvem em vez de apenas no computador?", choices: ["Fica inacessível fora de casa","Só funciona se o computador estiver ligado","Acesso de qualquer lugar e backup contra perdas do dispositivo","Gasta mais espaço no HD local"], correctIndex: 2, tip: "Disponibilidade + cópias/backup + colaboração." },
  { text: "O que é um datacenter?", choices: ["Um pendrive supergrande","Local com muitos servidores que armazenam e processam dados","Uma tomada inteligente","Um aplicativo de e-mail"], correctIndex: 1, tip: "Pense no 'PC do Professor Carvalho' com milhares de máquinas profissionais." },
];

function useSfx() {
  const ctxRef = useRef(null);
  function ensureCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  }
  function tone(freq = 880, dur = 0.12, type = "sine", vol = 0.05) {
    const ctx = ensureCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  return {
    correct: () => { tone(1046, 0.08, "triangle", 0.06); setTimeout(()=>tone(1318,0.08,"triangle",0.06),90); },
    wrong:   () => { tone(220, 0.16, "sawtooth", 0.07); },
    tick:    () => { tone(880, 0.03, "square", 0.03); },
    alarm:   () => { tone(330, 0.15, "square", 0.08); setTimeout(()=>tone(262,0.15,"square",0.08),160); },
    resume:  () => ensureCtx().resume?.(),
  };
}

function useConfetti() {
  const [pieces, setPieces] = useState([]);
  function burst() {
    const n = 18; const now = Date.now();
    const newPieces = Array.from({ length: n }).map((_, i) => ({
      id: now + i, x: Math.random() * 100, rot: (Math.random() * 60) - 30, emoji: ["✨","🎉","🟡","🔵","🟣"][Math.floor(Math.random()*5)]
    }));
    setPieces((p) => [...p, ...newPieces]);
    setTimeout(() => setPieces((p) => p.slice(n)), 1200);
  }
  const view = (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <div key={p.id} style={{ left: `${p.x}%`, transform: `rotate(${p.rot}deg)` }} className="absolute top-0 animate-[fall_1.2s_ease-in_forwards] text-xl">{p.emoji}</div>
      ))}
      <style>{`@keyframes fall{0%{top:-10%;opacity:1}100%{top:100%;opacity:0}}`}</style>
    </div>
  );
  return { burst, view };
}

export default function PokeCloudApp() {
  const containerRef = useRef(null);
  const [phase, setPhase] = useState("setup");
  const [teamMode, setTeamMode] = useState(3);
  const [teams, setTeams] = useState(() => makeTeams(3));
  const [activeTeam, setActiveTeam] = useState(0);
  const [minutes, setMinutes] = useState(6);
  const [secondsLeft, setSecondsLeft] = useState(6 * 60);
  const [cards, setCards] = useState(() => DEFAULT_POKEDATA.map((name, idx) => ({ id: idx + 1, name, state: "local" })));
  const [questionPool, setQuestionPool] = useState(QUESTION_BANK);
  const [currentQ, setCurrentQ] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [pendingCardId, setPendingCardId] = useState(null);
  const [showQModal, setShowQModal] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const sfx = useSfx();
  const { burst, view: confettiView } = useConfetti();

  useEffect(() => { if (phase === "setup") setSecondsLeft(minutes * 60); }, [minutes, phase]);

  useEffect(() => {
    if (phase !== "play" || paused) return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase, secondsLeft, paused]);

  useEffect(() => {
    if (phase === "play" && secondsLeft === 10) sfx.alarm();
    if (phase === "play" && secondsLeft <= 5 && secondsLeft > 0) sfx.tick();
    if (phase === "play" && secondsLeft === 0) {
      setCards((prev) => prev.map((c) => (c.state === "local" ? { ...c, state: "wiped" } : c)));
      setPhase("result");
      setResultMsg("O Hacker chegou! Tudo que estava fora da PokéCloud foi apagado.");
    }
  }, [secondsLeft, phase]);

  const localCards = cards.filter((c) => c.state === "local");
  const cloudCards = cards.filter((c) => c.state === "cloud");
  const wipedCards = cards.filter((c) => c.state === "wiped");
  const allMigrated = useMemo(() => cloudCards.length === cards.length, [cloudCards.length, cards.length]);

  useEffect(() => {
    if (phase === "play" && allMigrated) {
      setPhase("result");
      setResultMsg("Parabéns! Todos os Pokémon-dados foram migrados para a PokéCloud a tempo.");
    }
  }, [allMigrated, phase]);

  function makeTeams(n) {
    const presets = ["Equipe Vermelha", "Equipe Azul", "Equipe Amarela", "Equipe Verde", "Equipe Roxa"];
    return Array.from({ length: n }).map((_, i) => ({ name: presets[i] || `Equipe ${i + 1}`, score: 0 }));
  }

  function shuffle(arr) { return arr.map((x) => [Math.random(), x]).sort((a,b)=>a[0]-b[0]).map((x)=>x[1]); }

  const requestFs = useCallback(() => { const el = containerRef.current; if (!el) return; if (el.requestFullscreen) el.requestFullscreen(); }, []);
  const exitFs = useCallback(() => { if (document.exitFullscreen) document.exitFullscreen(); }, []);
  const rotateTeam = useCallback(() => { setActiveTeam((i) => (i + 1) % teams.length); }, [teams.length]);

  const askQuestionFor = useCallback((cardId) => {
    const q = questionPool[0] ?? QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
    setQuestionPool((prev) => [...prev.slice(1), q]);
    setCurrentQ(q);
    setSelectedChoice(null);
    setPendingCardId(cardId);
    setShowQModal(true);
  }, [questionPool]);

  const checkAnswer = useCallback(() => {
    if (selectedChoice == null || !currentQ) return;
    const isCorrect = selectedChoice === currentQ.correctIndex;
    if (isCorrect) {
      setCards((prev) => prev.map((c) => (c.id === pendingCardId ? { ...c, state: "cloud" } : c)));
      setTeams((arr) => arr.map((t, i) => (i === activeTeam ? { ...t, score: t.score + 1 } : t)));
      setResultMsg("✅ Correto! Dados migrados para a PokéCloud.");
      sfx.correct(); burst(); rotateTeam();
    } else {
      setResultMsg("❌ Quase! Resposta incorreta. Tente de novo na próxima rodada.");
      sfx.wrong(); rotateTeam();
    }
    setShowQModal(false); setPendingCardId(null); setTimeout(() => setResultMsg(""), 1800);
  }, [selectedChoice, currentQ, pendingCardId, activeTeam, sfx, burst, rotateTeam]);

  const skipTurn = useCallback(() => { rotateTeam(); setShowQModal(false); setPendingCardId(null); }, [rotateTeam]);

  const startGame = useCallback(() => {
    setTeams((prev) => prev.map((t) => ({ ...t, score: 0 })));
    setActiveTeam(0);
    setCards((prev) => prev.map((c, i) => ({ id: i + 1, name: c.name, state: "local" })));
    setQuestionPool((prev) => shuffle([...prev]));
    setSecondsLeft(minutes * 60);
    setPhase("play");
    setPaused(false);
    if (document.fullscreenElement == null) requestFs();
  }, [minutes, requestFs]);

  const resetAll = useCallback(() => {
    setPhase("setup"); setTeams(makeTeams(teamMode)); setActiveTeam(0);
    setCards(DEFAULT_POKEDATA.map((name, idx) => ({ id: idx + 1, name, state: "local" })));
    setQuestionPool(QUESTION_BANK); setCurrentQ(null); setSelectedChoice(null); setPendingCardId(null);
    setShowQModal(false); setResultMsg(""); setSecondsLeft(6 * 60); setMinutes(6); setPaused(false); exitFs();
  }, [teamMode, exitFs]);

  function downloadJSON(obj, filename) {
    const data = JSON.stringify(obj, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function readJSONFile(e, cb) {
    const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => { try { const json = JSON.parse(reader.result); cb(json); } catch { alert("Não foi possível ler o JSON."); } };
    reader.readAsText(file);
  }
  function exportQuestions() { downloadJSON(questionPool, "pokécloud_perguntas.json"); }
  function importQuestions(e) {
    readJSONFile(e, (json) => {
      if (Array.isArray(json) && json.every(v => v.text && v.choices && typeof v.correctIndex === 'number')) setQuestionPool(json);
      else alert("JSON inválido. Esperado: [{ text, choices[], correctIndex, tip? }]");
    });
  }
  function exportCards() { downloadJSON(cards.map(c=>({ name: c.name })), "pokécloud_cartas.json"); }
  function importCards(e) {
    readJSONFile(e, (json) => {
      if (Array.isArray(json) && json.every(v => typeof v.name === 'string')) setCards(json.map((v, i) => ({ id: i + 1, name: v.name, state: "local" })));
      else alert("JSON inválido. Esperado: [{ name }]");
    });
  }

  function openReport() {
    const win = window.open("", "_blank"); if (!win) return;
    const css = `body{font-family:system-ui,Arial;margin:24px} h1{margin:0 0 8px} .muted{color:#555} table{border-collapse:collapse;width:100%;margin-top:12px} td,th{border:1px solid #ccc;padding:6px}`;
    const teamRow = teams.map(t=>`<tr><td>${escapeHtml(t.name)}</td><td>${t.score}</td></tr>`).join("");
    const cardRows = cards.map(c=>`<tr><td>${c.id}</td><td>${escapeHtml(c.name)}</td><td>${c.state}</td></tr>`).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório — PokéCloud</title><style>${css}</style></head><body>
      <h1>Relatório — PokéCloud</h1>
      <div class="muted">Resumo da missão</div>
      <ul>
        <li>Cartões migrados: <b>${cloudCards.length}</b> de ${cards.length}</li>
        <li>Cartões apagados: <b>${wipedCards.length}</b></li>
        <li>Tempo configurado: <b>${minutes} min</b></li>
      </ul>
      <h3>Placar</h3>
      <table><thead><tr><th>Time</th><th>Pontos</th></tr></thead><tbody>${teamRow}</tbody></table>
      <h3>Cartas</h3>
      <table><thead><tr><th>#</th><th>Nome</th><th>Status</th></tr></thead><tbody>${cardRows}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
    </body></html>`);
    win.document.close();
  }
  function escapeHtml(s="") { return s.replace(/[&<>\"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }

  useEffect(() => {
    function onKey(e) {
      if (e.target && ["INPUT","TEXTAREA"].includes(e.target.tagName)) return;
      const key = e.key;
      if (key === "?" || (key === "/" && e.shiftKey)) { setShowHelp((v) => !v); return; }
      if (key.toLowerCase() === "f") { requestFs(); return; }
      if (phase === "play") {
        if (!showQModal) {
          if (key === " ") { e.preventDefault(); setPaused((p)=>!p); return; }
          if (key.toLowerCase() === "n") { if (localCards[0]) askQuestionFor(localCards[0].id); return; }
          if (key.toLowerCase() === "s") { setPaused(false); return; }
        } else {
          if (["1","2","3","4"].includes(key)) { setSelectedChoice(Number(key)-1); return; }
          if (key === "Enter") { sfx.resume(); checkAnswer(); return; }
          if (key === "Escape") { skipTurn(); return; }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, showQModal, localCards, askQuestionFor, checkAnswer, skipTurn, requestFs, sfx]);

  return (
    <div ref={containerRef} className="min-h-screen w-full bg-gradient-to-b from-pokecloud-50 to-pokecloud-100 p-3 sm:p-5 text-pokecloud-900">
      {confettiView}
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">PokéCloud: <span className="text-pokecloud-700">Missão na Nuvem</span></h1>
          <div className="flex flex-wrap items-center gap-2">
            <Chip className="bg-pcloud-emerald/15 text-pcloud-emerald">EJA • Edutainment</Chip>
            <Chip className="bg-pcloud-sky/15 text-pcloud-sky">Cloud & Datacenter</Chip>
            <PillButton onClick={requestFs} className="hidden sm:inline-block">Tela cheia</PillButton>
            <PillButton onClick={()=>setShowHelp(true)} className="bg-gray-700 hover:bg-gray-800">Ajuda (?)</PillButton>
          </div>
        </header>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Section title="Placar" icon={<span>🎯</span>}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {teams.map((t, i) => (
                  <div key={i} className={`rounded-2xl px-3 py-2 ${i === activeTeam ? "bg-pokecloud-50 ring-2 ring-pokecloud-200" : "bg-white"}`}>
                    <div className="text-[10px] uppercase text-gray-500">{t.name}</div>
                    <div className="text-xl font-black text-pokecloud-700 text-center">{t.score}</div>
                  </div>
                ))}
              </div>
              <div className="text-sm font-semibold">Vez da: {teams[activeTeam]?.name}</div>
            </div>
          </Section>

          <Section title="Tempo até o Hacker" icon={<span>⏳</span>}>
            <TimerBar secondsLeft={secondsLeft} totalSeconds={minutes * 60} phase={phase} lowPulse={secondsLeft <= 10 && phase === "play"} />
            <div className="mt-2 flex items-center gap-2">
              {phase === "play" && (
                <>
                  <PillButton onClick={() => setPaused((p) => !p)} className="bg-gray-700 hover:bg-gray-800">{paused ? "Retomar" : "Pausar"}</PillButton>
                  <PillButton onClick={exitFs} className="bg-gray-700 hover:bg-gray-800">Sair Tela Cheia</PillButton>
                  <PillButton onClick={openReport}>Relatório (PDF)</PillButton>
                </>
              )}
            </div>
          </Section>

          <Section title="Status da Migração" icon={<span>☁️</span>}>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-gray-400" />Local: {localCards.length}</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pcloud-sky" />PokéCloud: {cloudCards.length}</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pcloud-rose" />Apagados: {wipedCards.length}</div>
            </div>
          </Section>
        </div>

        {phase === "setup" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Section title="Configuração" icon={<span>⚙️</span>} className="lg:col-span-1">
              <div className="grid gap-3 text-sm">
                <label className="grid gap-1">
                  Quantidade de times (1 • 3 • 5)
                  <div className="flex gap-2">
                    {[1,3,5].map((n) => (
                      <button key={n} onClick={() => { setTeamMode(n); setTeams(makeTeams(n)); }} className={`rounded-xl px-3 py-2 ${teamMode===n?"bg-pokecloud-600 text-white":"bg-pokecloud-50"}`}>{n}</button>
                    ))}
                  </div>
                </label>
                <div className="grid gap-2">
                  {teams.map((t, i) => (
                    <label key={i} className="text-xs">Nome do Time {i+1}
                      <input className="mt-1 w-full rounded-xl border px-3 py-2" value={t.name} onChange={(e)=> setTeams((arr)=> arr.map((tt,idx)=> idx===i?{...tt,name:e.target.value}:tt))} />
                    </label>
                  ))}
                </div>
                <label className="text-xs">
                  Minutos até o Hacker chegar
                  <input type="number" min={1} className="mt-1 w-32 rounded-xl border px-3 py-2" value={minutes} onChange={(e)=> setMinutes(Math.max(1, Number(e.target.value)||1))} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <PillButton onClick={startGame} className="w-full sm:w-auto">Começar Missão</PillButton>
                  <PillButton onClick={requestFs} className="bg-gray-700 hover:bg-gray-800">Tela cheia</PillButton>
                </div>
              </div>
            </Section>

            <Section title="Banco de Perguntas & Cartas" icon={<span>🧠</span>} className="lg:col-span-2">
              <QuestionEditor questionPool={questionPool} setQuestionPool={setQuestionPool} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PillButton onClick={exportQuestions}>Exportar Perguntas JSON</PillButton>
                <label className="text-sm"><span className="mr-2">Importar Perguntas</span><input type="file" accept="application/json" onChange={importQuestions} className="text-xs" /></label>
                <PillButton onClick={exportCards}>Exportar Cartas JSON</PillButton>
                <label className="text-sm"><span className="mr-2">Importar Cartas</span><input type="file" accept="application/json" onChange={importCards} className="text-xs" /></label>
              </div>
            </Section>
          </div>
        )}

        {phase === "play" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Section title="Datacenter (Local)" icon={<span>🖥️</span>} className="lg:col-span-1">
              <CardGrid>
                {localCards.length === 0 && <EmptyState text="Sem dados locais. Continue migrando!" />}
                {localCards.map((c) => (
                  <CardItem key={c.id} onClick={() => askQuestionFor(c.id)}>
                    <div className="text-[11px] text-gray-500">Dado #{c.id}</div>
                    <div className="text-sm font-bold">{c.name}</div>
                    <div className="text-[10px] text-gray-400">Toque para migrar</div>
                  </CardItem>
                ))}
              </CardGrid>
            </Section>

            <Section title="Ação" icon={<span>🚀</span>} className="lg:col-span-1">
              <div className="grid place-items-center gap-3 p-2 text-center">
                <div className="text-sm text-gray-600">Selecione um cartão e responda para migrar para a PokéCloud.</div>
                {resultMsg && <div className="rounded-xl bg-pokecloud-700 px-4 py-2 text-sm text-white">{resultMsg}</div>}
                <div className="text-xs text-gray-500">Turno de: <span className="font-semibold">{teams[activeTeam]?.name}</span></div>
                <div className="text-[11px] text-gray-400">Dica: mini revisões a cada 3 migrações.</div>
              </div>
            </Section>

            <Section title="PokéCloud (Nuvem)" icon={<span>☁️</span>} className="lg:col-span-1">
              <CardGrid>
                {cloudCards.length === 0 && <EmptyState text="Nada na nuvem ainda." />}
                {cloudCards.map((c) => (
                  <CardItem key={c.id} tone="cloud">
                    <div className="text-[11px] text-gray-500">Dado #{c.id}</div>
                    <div className="text-sm font-bold">{c.name}</div>
                    <div className="text-[10px] text-pokecloud-700">Protegido na PokéCloud</div>
                  </CardItem>
                ))}
              </CardGrid>
            </Section>
          </div>
        )}

        {phase === "result" && (
          <Section title="Resultado da Missão" icon={<span>🏁</span>}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-sm text-gray-600">Resumo</div>
                <ul className="list-inside list-disc text-sm">
                  <li>Cartões migrados: <strong>{cloudCards.length}</strong> de {cards.length}</li>
                  <li>Cartões apagados: <strong className="text-pcloud-rose">{wipedCards.length}</strong></li>
                  <li>Placar final: {teams.map((t,i)=> (<span key={i} className="mr-2"><strong>{t.name}</strong> {t.score}</span>))}</li>
                </ul>
                <div className="mt-3 rounded-xl bg-pokecloud-50 p-3 text-sm">{resultMsg || "Missão concluída!"}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <PillButton onClick={startGame}>Jogar de novo</PillButton>
                  <PillButton onClick={resetAll} className="bg-gray-700 hover:bg-gray-800">Voltar à Configuração</PillButton>
                  <PillButton onClick={openReport}>Relatório (PDF)</PillButton>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm text-gray-600">Reflexão guiada (pós-jogo)</div>
                <ol className="list-inside list-decimal text-sm">
                  <li>Como isso se parece com salvar no Google Drive/OneDrive/iCloud?</li>
                  <li>O que acontece se tudo ficar apenas no celular e ele quebrar?</li>
                  <li>Por que empresas preferem escalar recursos na nuvem?</li>
                  <li>Exemplos do seu dia a dia que já usam nuvem?</li>
                </ol>
              </div>
            </div>
          </Section>
        )}

        {showQModal && currentQ && (
          <Modal onClose={skipTurn}>
            <div className="mb-4 text-base font-bold">{currentQ.text}</div>
            <div className="grid gap-2">
              {currentQ.choices.map((c, idx) => (
                <label key={idx} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${selectedChoice === idx ? "border-pokecloud-500 bg-pokecloud-50" : "border-gray-200 bg-white"}`}>
                  <input type="radio" name="q" className="accent-pokecloud-600" checked={selectedChoice === idx} onChange={() => setSelectedChoice(idx)} />
                  <span>{c}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500">Dica: {currentQ.tip}</div>
            <div className="mt-4 flex justify-end gap-2">
              <PillButton onClick={skipTurn} className="bg-gray-700 hover:bg-gray-800">Pular</PillButton>
              <PillButton onClick={() => { sfx.resume(); checkAnswer(); }} disabled={selectedChoice == null}>Responder</PillButton>
            </div>
          </Modal>
        )}

        {showHelp && (
          <Modal onClose={()=>setShowHelp(false)}>
            <div className="mb-2 text-base font-bold">Ajuda rápida (Modo Professor)</div>
            <ul className="list-inside list-disc text-sm">
              <li><b>F</b>: Tela cheia</li>
              <li><b>Espaço</b>: Pausar/Retomar</li>
              <li><b>N</b>: Abrir próxima pergunta (do primeiro cartão local)</li>
              <li><b>S</b>: Retomar (se pausado)</li>
              <li>Durante a pergunta: <b>1-4</b> para marcar alternativas, <b>Enter</b> para responder, <b>Esc</b> para pular</li>
              <li><b>?</b> ou <b>Shift+/</b>: Abrir/fechar este painel</li>
            </ul>
          </Modal>
        )}

        <footer className="mt-6 text-center text-[11px] text-gray-500">Feito com carinho para o EJA — PokéCloud • por você ✨</footer>
      </div>
    </div>
  );
}

function TimerBar({ secondsLeft, totalSeconds, phase, lowPulse }) {
  const pct = Math.max(0, Math.min(100, (secondsLeft / (totalSeconds || 1)) * 100));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
        <span>{phase === "play" ? "Contagem regressiva" : "Defina o tempo e comece"}</span>
        <span className={`font-mono ${lowPulse ? "animate-pulse" : ""}`}>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full bg-gradient-to-r from-pcloud-rose via-pcloud-sun to-pcloud-emerald ${lowPulse?"animate-pulse":""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CardGrid({ children }) { return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{children}</div>; }

function CardItem({ children, onClick, tone = "local" }) {
  const toneStyles = tone === "cloud" ? "border-pokecloud-200 bg-pokecloud-50 hover:bg-pokecloud-100" : tone === "wiped" ? "border-pcloud-rose/40 bg-pcloud-rose/10" : "border-gray-200 bg-white hover:bg-gray-50";
  return (
    <button onClick={onClick} className={`group h-24 rounded-2xl border p-3 text-left shadow-sm transition ${toneStyles}`}>
      <div className="h-full w-full">{children}</div>
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div className="col-span-full grid place-items-center rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        {children}
        <div className="mt-3 text-right"><button onClick={onClose} className="text-xs text-gray-500 underline">fechar</button></div>
      </div>
    </div>
  );
}

function QuestionEditor({ questionPool, setQuestionPool }) {
  const [qText, setQText] = useState("");
  const [alt1, setAlt1] = useState("");
  const [alt2, setAlt2] = useState("");
  const [alt3, setAlt3] = useState("");
  const [alt4, setAlt4] = useState("");
  const [correct, setCorrect] = useState(1);
  const [tip, setTip] = useState("");

  function addQuestion() {
    if (!qText || !alt1 || !alt2 || !alt3 || !alt4) return;
    const q = { text: qText, choices: [alt1, alt2, alt3, alt4], correctIndex: Math.max(0, Math.min(3, Number(correct) - 1)), tip: tip || "" };
    setQuestionPool((prev) => [...prev, q]);
    setQText(""); setAlt1(""); setAlt2(""); setAlt3(""); setAlt4(""); setCorrect(1); setTip("");
  }

  function removeQuestion(idx) { setQuestionPool((prev) => prev.filter((_, i) => i !== idx)); }

  return (
    <div className="grid gap-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <input className="rounded-xl border px-3 py-2" placeholder="Pergunta" value={qText} onChange={(e) => setQText(e.target.value)} />
        <input className="rounded-xl border px-3 py-2" placeholder="Dica (opcional)" value={tip} onChange={(e) => setTip(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="rounded-xl border px-3 py-2" placeholder="Alternativa 1" value={alt1} onChange={(e) => setAlt1(e.target.value)} />
        <input className="rounded-xl border px-3 py-2" placeholder="Alternativa 2" value={alt2} onChange={(e) => setAlt2(e.target.value)} />
        <input className="rounded-xl border px-3 py-2" placeholder="Alternativa 3" value={alt3} onChange={(e) => setAlt3(e.target.value)} />
        <input className="rounded-xl border px-3 py-2" placeholder="Alternativa 4" value={alt4} onChange={(e) => setAlt4(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 items-end gap-2">
        <label className="text-xs">Alternativa correta (1-4)
          <input type="number" min={1} max={4} className="mt-1 w-24 rounded-xl border px-3 py-2" value={correct} onChange={(e) => setCorrect(e.target.value)} />
        </label>
        <div className="text-right"><PillButton onClick={addQuestion}>Adicionar</PillButton></div>
      </div>
      <div className="mt-2 max-h-40 overflow-auto rounded-xl border">
        {questionPool.map((q, i) => (
          <div key={i} className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs last:border-b-0">
            <div className="truncate"><span className="mr-1 font-semibold">{i+1}.</span>{q.text}</div>
            <button onClick={()=>removeQuestion(i)} className="rounded-lg bg-pcloud-rose/15 px-2 py-1 text-pcloud-rose">remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}
