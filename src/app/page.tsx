"use client";

import {
  ArrowDownToLine, ArrowLeft, AudioLines, AudioWaveform, Check, ChevronDown,
  CircleHelp, Clock3, CloudUpload, CreditCard, Headphones, History, LayoutDashboard,
  LockKeyhole, Menu, Mic2, MoreHorizontal, Play, Settings2, Share2,
  SlidersHorizontal, Sparkles, UserRound, Volume2, WandSparkles, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Section = "studio" | "cloning" | "history" | "billing" | "settings";
type Voice = { id: string; name: string; detail: string; language: string };
type Generation = { id: string; text: string; voice: string; date: string };
type SavedVoice = { id: string; name: string; language: string; accent: string | null; gender: string | null };

const voices: Voice[] = [
  { id: "arabic-saudi-male", name: "راشد", detail: "سعودي · رجالي · دافئ", language: "ar-SA" },
  { id: "arabic-egyptian-female", name: "ليلى", detail: "مصري · نسائي · حيوي", language: "ar-EG" },
  { id: "arabic-modern-female", name: "نور", detail: "فصحى · نسائي · هادئ", language: "ar-SA" },
  { id: "english-british-male", name: "Oliver", detail: "British · Male · Calm", language: "en-GB" },
  { id: "english-american-female", name: "Maya", detail: "American · Female · Bright", language: "en-US" },
];
const navigation: { id: Section; label: string; icon: typeof AudioLines }[] = [
  { id: "studio", label: "الاستوديو", icon: AudioLines },
  { id: "cloning", label: "استنساخ الصوت", icon: Mic2 },
  { id: "history", label: "سجلّ الأصوات", icon: History },
  { id: "billing", label: "الفوترة والخطة", icon: CreditCard },
  { id: "settings", label: "الإعدادات", icon: Settings2 },
];
const initialText = "في كل كلمة حكاية، وفي كل صوت إحساس. حوّل أفكارك إلى تجربة صوتية تبقى في الذاكرة.";

function appPath(path: string) {
  const prefix = window.location.pathname.match(/^\/proxy\/[^/]+/)?.[0] ?? "";
  return `${prefix}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function Home() {
  const router = useRouter();
  const [supabase] = useState(createSupabaseBrowserClient);
  const [section, setSection] = useState<Section>("studio");
  const [text, setText] = useState(initialText);
  const [voiceId, setVoiceId] = useState(voices[0].id);
  const [stability, setStability] = useState(58);
  const [similarity, setSimilarity] = useState(76);
  const [speed, setSpeed] = useState(100);
  const [volume, setVolume] = useState(100);
  const [history, setHistory] = useState<Generation[]>([]);
  const [customVoices, setCustomVoices] = useState<Voice[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState("");
  const [newVoiceLanguage, setNewVoiceLanguage] = useState("ar");
  const [newVoiceAccent, setNewVoiceAccent] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const allVoices = [...voices, ...customVoices];
  const selectedVoice = allVoices.find((voice) => voice.id === voiceId) ?? voices[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("vocalaba-history");
        if (saved) setHistory(JSON.parse(saved) as Generation[]);
      } catch {
        localStorage.removeItem("vocalaba-history");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("generation_history")
        .select("id, text_snippet, voice_id, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!mounted || !data) return;
      const saved = data.map((item) => ({
        id: item.id,
        text: item.text_snippet,
        voice: voices.find((voice) => voice.id === item.voice_id)?.name ?? "صوت مخصص",
        date: item.created_at,
      }));
      setHistory(saved);
      localStorage.setItem("vocalaba-history", JSON.stringify(saved));
    })();
    return () => { mounted = false; };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const owner = ["albadwi730@gmail.com", "gmilsaed2@gmail.com"].includes(user?.email?.trim().toLowerCase() ?? "");
      if (!mounted) return;
      setIsOwner(owner);
      if (!owner) return;
      const response = await fetch(appPath("/api/voices"));
      if (!response.ok) return;
      const result = (await response.json()) as { voices: SavedVoice[] };
      if (!mounted) return;
      setCustomVoices(result.voices
        .filter((voice) => !voices.some((preset) => preset.id === voice.id))
        .map((voice) => ({
          id: voice.id,
          name: voice.name,
          detail: [voice.accent, voice.gender].filter(Boolean).join(" · ") || voice.language,
          language: voice.language,
        })));
    })().catch(() => {
      if (mounted) setVoiceStatus("تعذّر تحميل الأصوات المحفوظة.");
    });
    return () => { mounted = false; };
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const auth = new URLSearchParams(window.location.search).get("auth");
      if (auth === "login") { setAuthMode("login"); setShowAuth(true); }
      if (auth === "setup") setNotice("أضف إعدادات Supabase في ملف البيئة لتفعيل الحسابات.");
      if (auth === "error") setNotice("تعذّر تسجيل الدخول. تحقق من بريدك أو إعدادات OAuth.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume, audioUrl]);

  function addToHistory(item: Generation) {
    setHistory((current) => {
      const updated = [item, ...current].slice(0, 20);
      localStorage.setItem("vocalaba-history", JSON.stringify(updated));
      return updated;
    });
  }

  async function generateAudio() {
    if (!text.trim()) { setError("اكتب نصًا أولًا لتبدأ التوليد."); return; }
    setError(""); setNotice(""); setAudioUrl(""); setIsGenerating(true);
    window.speechSynthesis?.cancel();
    try {
      const response = await fetch(appPath("/api/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId, settings: { stability: stability / 100, similarity: similarity / 100, speed: speed / 100 } }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}) as { error?: string })) as { error?: string };
        const fallbackMessage = result.error ?? "تعذّر توليد الصوت.";

        if (response.status === 401 || response.status === 503) {
          setDemoMode(true);
          setNotice("لم يتم تفعيل خدمة الصوت الحقيقية، تم تشغيل معاينة المتصفح فقط.");
          window.setTimeout(() => { playDemo(); }, 120);
          addToHistory({ id: crypto.randomUUID(), text, voice: selectedVoice.name, date: new Date().toISOString() });
          return;
        }

        throw new Error(fallbackMessage);
      }

      const id = crypto.randomUUID();
      if ((response.headers.get("content-type") ?? "").includes("audio/")) {
        setAudioUrl(URL.createObjectURL(await response.blob()));
        setDemoMode(false);
      } else {
        const result = (await response.json()) as { demo?: boolean; message?: string };
        if (!result.demo) throw new Error("استجابة الصوت غير متوقعة.");
        setDemoMode(true);
        setNotice(result.message ?? "معاينة تجريبية بصوت جهازك. فعّل ElevenLabs لتصدير MP3 احترافي.");
        window.setTimeout(() => { playDemo(); }, 150);
      }
      addToHistory({ id, text, voice: selectedVoice.name, date: new Date().toISOString() });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "حدث خطأ غير متوقع.");
    } finally {
      setIsGenerating(false);
    }
  }

  function playDemo() {
    if (!("speechSynthesis" in window)) { setError("المعاينة غير متاحة في هذا المتصفح."); return; }
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedVoice.language;
    utterance.rate = speed / 100;
    utterance.volume = volume / 100;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  async function shareAudio() {
    try {
      if (navigator.share) await navigator.share({ title: "صوت من Vocalaba", text: text.slice(0, 120) });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); setNotice("نُسخ النص إلى الحافظة."); }
    } catch { setNotice("تعذّرت المشاركة الآن."); }
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/") || file.size > 25 * 1024 * 1024) {
      setError("اختر ملفًا صوتيًا صالحًا بحجم لا يتجاوز 25 ميجابايت."); return;
    }
    setError(""); setUploadedFile(file.name);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supabase) { setError("إعداد Supabase غير مكتمل. تحقق من إعدادات البيئة وأعد تشغيل الخادم."); return; }
    setIsAuthLoading(true);
    try {
      const result = authMode === "signup"
        ? await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { emailRedirectTo: `${window.location.origin}${appPath("/auth/callback")}?next=${encodeURIComponent(appPath("/dashboard"))}` } })
        : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (result.error) { setError(result.error.message); return; }
      if (authMode === "signup" && !result.data.session) {
        setShowAuth(false);
        setNotice("تحقق من بريدك الإلكتروني لإكمال إنشاء الحساب.");
        return;
      }
      setShowAuth(false);
      router.push(appPath("/dashboard"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذّر الاتصال بخدمة تسجيل الدخول.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase) { setShowAuth(false); setNotice("أضف إعدادات Supabase وفعّل Google OAuth."); return; }
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${appPath("/auth/callback")}?next=${encodeURIComponent(appPath("/dashboard"))}` },
      });
      if (authError) setError(authError.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذّر الاتصال بخدمة Google. فعّل Google OAuth في Supabase.");
    }
  }

  async function startCheckout() {
    const response = await fetch(appPath("/api/stripe/checkout"), { method: "POST" });
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url) {
      setNotice(result.error ?? "تعذّر بدء الدفع. تحقق من تسجيل الدخول وإعداد Stripe.");
      return;
    }
    window.location.assign(result.url);
  }

  async function addVoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVoiceStatus("");
    setIsSavingVoice(true);
    try {
      const response = await fetch(appPath("/api/voices"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newVoiceName, language: newVoiceLanguage, accent: newVoiceAccent }),
      });
      const result = (await response.json()) as { voice?: SavedVoice; error?: string };
      if (!response.ok || !result.voice) throw new Error(result.error ?? "تعذّر إضافة الصوت.");
      const added: Voice = {
        id: result.voice.id,
        name: result.voice.name,
        language: result.voice.language,
        detail: [result.voice.accent, result.voice.gender].filter(Boolean).join(" · ") || result.voice.language,
      };
      setCustomVoices((current) => [...current, added]);
      setVoiceId(added.id);
      setNewVoiceName("");
      setNewVoiceAccent("");
      setVoiceStatus("تمت إضافة الصوت إلى قائمة الاستوديو.");
    } catch (caught) {
      setVoiceStatus(caught instanceof Error ? caught.message : "تعذّرت إضافة الصوت.");
    } finally {
      setIsSavingVoice(false);
    }
  }

  function renderContent() {
    if (section === "cloning") return <section className="content-panel clone-panel">
      <div className="section-kicker"><Mic2 size={15} /> استوديو الأصوات</div><h2>صوتك، لكن بنسخة رقمية.</h2>
      <p className="section-copy">ارفع عينة واضحة من صوت تملك حق استخدامه.</p>
      <label className="upload-zone"><input type="file" accept="audio/*" onChange={handleUpload} /><span className="upload-icon"><CloudUpload size={22} /></span><strong>{uploadedFile || "اسحب ملفك الصوتي إلى هنا"}</strong><span>MP3 أو WAV أو M4A · حتى 25 MB</span><span className="upload-action">اختيار ملف <ArrowLeft size={15} /></span></label>
      <div className="recording-notes"><h3><CircleHelp size={17} /> عينة مثالية</h3><div className="note-grid"><p><Check size={15} /> سجّل من 10 إلى 30 ثانية في مكان هادئ.</p><p><Check size={15} /> تحدث بنبرة طبيعية وبمسافة ثابتة.</p><p><Check size={15} /> استخدم صوتك أو صوتًا لديك إذن باستنساخه.</p></div></div>
      <button className="primary-button" disabled={!uploadedFile} onClick={() => setNotice("اربط هذه الواجهة بمسار ElevenLabs لاستنساخ الصوت.")}><WandSparkles size={17} /> إنشاء صوت مخصص</button><p className="muted-note">استنساخ الصوت يحتاج مفتاح ElevenLabs وحسابًا مؤهلًا.</p>
    </section>;

    if (section === "history") return <section className="content-panel history-panel"><div className="section-kicker"><Clock3 size={15} /> مكتبتك الصوتية</div><div className="panel-title-row"><div><h2>سجلّ الأصوات</h2><p className="section-copy">كل ما أنشأته، في مكان واحد.</p></div><span className="history-total">{history.length} عناصر</span></div>
      {!history.length ? <div className="empty-state"><AudioWaveform size={30} /><strong>لا توجد تسجيلات بعد</strong><span>أول صوت تنشئه سيظهر هنا.</span><button className="text-button" onClick={() => setSection("studio")}>ابدأ من الاستوديو <ArrowLeft size={14} /></button></div> : <div className="history-table-wrap"><table className="history-table"><thead><tr><th>النص</th><th>الصوت</th><th>التاريخ</th><th><span className="sr-only">تشغيل</span></th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td className="history-text">{item.text.slice(0, 74)}{item.text.length > 74 ? "…" : ""}</td><td>{item.voice}</td><td>{new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(item.date))}</td><td><button className="icon-button" aria-label="فتح النص في الاستوديو" onClick={() => { setText(item.text); setVoiceId(voices.find((voice) => voice.name === item.voice)?.id ?? voices[0].id); setSection("studio"); }}><Play size={15} /></button></td></tr>)}</tbody></table></div>}</section>;

    if (section === "billing") return <section className="content-panel billing-panel"><div className="section-kicker"><CreditCard size={15} /> خطتك الحالية</div><h2>ابدأ مجانًا. وسّع إمكانياتك وقتما تريد.</h2><div className="plan-grid">{[{ name: "مجاني", price: "0", description: "لتجربة أصواتك الأولى", features: ["10,000 حرف شهريًا", "أصوات أساسية", "سجل آخر 20 عملية"] }, { name: "Pro", price: "12", description: "لصنّاع المحتوى والفرق", features: ["100,000 حرف شهريًا", "أصوات مميزة", "استنساخ صوت مخصص"] }, { name: "أعمال", price: "مخصص", description: "للفرق والمنتجات الكبيرة", features: ["حجم استخدام مرن", "دعم مخصص", "تعاون وإدارة فريق"] }].map((plan, index) => <article className={`plan-card ${index === 1 ? "plan-featured" : ""}`} key={plan.name}>{index === 1 && <span className="popular-label">الأكثر اختيارًا</span>}<h3>{plan.name}</h3><p>{plan.description}</p><div className="plan-price">{plan.price === "مخصص" ? plan.price : <>{plan.price}<small> / شهريًا</small></>}</div><ul>{plan.features.map((feature) => <li key={feature}><Check size={15} /> {feature}</li>)}</ul><button className={index === 1 ? "primary-button" : "secondary-button"} onClick={index === 1 ? startCheckout : () => setNotice(index === 0 ? "أنت على الخطة المجانية." : "تواصل معنا لإعداد خطة الأعمال.")}>{index === 2 ? "تواصل معنا" : index === 0 ? "الخطة الحالية" : "ترقية إلى Pro"}</button></article>)}</div><p className="muted-note">الأسعار توضيحية. أضف Price ID في البيئة لتفعيل Stripe.</p></section>;

    if (section === "settings") return <section className="content-panel settings-panel"><div className="section-kicker"><Settings2 size={15} /> مساحة العمل</div><h2>إعدادات حسابك</h2><div className="settings-row"><span className="settings-avatar"><UserRound size={19} /></span><span><strong>مساحة عمل تجريبية</strong><small>الحسابات غير مفعّلة بعد</small></span><button className="secondary-button" onClick={() => { setAuthMode("signup"); setShowAuth(true); }}>إنشاء حساب</button></div><div className="settings-row"><span className="settings-avatar"><LockKeyhole size={19} /></span><span><strong>الخصوصية والبيانات</strong><small>يحفظ السجل على هذا الجهاز فقط.</small></span><button className="text-button" onClick={() => { localStorage.removeItem("vocalaba-history"); setHistory([]); setNotice("تم مسح سجل هذا الجهاز."); }}>مسح السجل</button></div>{isOwner && <div className="voice-manager"><h3>إدارة الأصوات</h3><p className="section-copy">أضف اسمًا ولغة مدعومة. Google TTS يحدد اللغة فقط ولا ينشئ هوية صوت جديدة.</p><form className="voice-manager-form" onSubmit={addVoice}><label>اسم الصوت<input required maxLength={60} value={newVoiceName} onChange={(event) => setNewVoiceName(event.target.value)} placeholder="مثال: صوت عربي فصيح" /></label><label>رمز اللغة<input required pattern="[a-z]{2,3}(-[A-Z]{2})?" value={newVoiceLanguage} onChange={(event) => setNewVoiceLanguage(event.target.value)} placeholder="ar أو en-US" /></label><label>اللهجة أو الوصف<input maxLength={60} value={newVoiceAccent} onChange={(event) => setNewVoiceAccent(event.target.value)} placeholder="مثال: خليجي" /></label><button className="primary-button" type="submit" disabled={isSavingVoice}>{isSavingVoice ? "جارٍ الحفظ…" : "إضافة صوت"}</button></form>{voiceStatus && <p className="inline-message notice-message" role="status">{voiceStatus}</p>}{customVoices.length > 0 && <ul className="managed-voice-list">{customVoices.map((voice) => <li key={voice.id}><span>{voice.name}</span><small>{voice.detail}</small></li>)}</ul>}</div>}</section>;

    return <section className="studio-grid" aria-label="استوديو تحويل النص إلى كلام">
      <div className="content-panel editor-panel"><div className="panel-heading"><div><div className="section-kicker"><Sparkles size={15} /> مساحة الكتابة</div><h2>ما الذي تريد أن تقوله؟</h2></div><button className="icon-button" aria-label="خيارات النص"><MoreHorizontal size={19} /></button></div>
        <label className="sr-only" htmlFor="speech-text">النص المراد تحويله إلى صوت</label><textarea id="speech-text" maxLength={5000} value={text} onChange={(event) => setText(event.target.value)} placeholder="اكتب نصك هنا..." dir="auto" />
        <div className="editor-footer"><span className={text.length > 4700 ? "count-warning" : ""}>{text.length.toLocaleString("ar")}/٥٬٠٠٠ حرف</span><button className="text-button" onClick={() => setText("")} disabled={!text}><X size={14} /> مسح النص</button></div>
        <div className="control-divider" /><div className="voice-row"><label htmlFor="voice-select"><span className="control-icon"><Mic2 size={16} /></span><span><strong>الصوت</strong><small>اختر النبرة المناسبة</small></span></label><div className="select-wrap"><select id="voice-select" value={voiceId} onChange={(event) => setVoiceId(event.target.value)}>{allVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} — {voice.detail}</option>)}</select><ChevronDown size={15} /></div></div>
        <div className="control-divider" /><details className="advanced-settings"><summary><span><SlidersHorizontal size={16} /> إعدادات الصوت</span><ChevronDown className="details-chevron" size={16} /></summary><div className="sliders-grid"><label className="slider-control"><span><span>الثبات</span><output>{stability}%</output></span><input type="range" min="0" max="100" value={stability} onChange={(event) => setStability(Number(event.target.value))} /></label><label className="slider-control"><span><span>وضوح الصوت</span><output>{similarity}%</output></span><input type="range" min="0" max="100" value={similarity} onChange={(event) => setSimilarity(Number(event.target.value))} /></label><label className="slider-control"><span><span>مستوى الصوت</span><output>{volume}%</output></span><input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label><label className="slider-control speed-control"><span><span>سرعة الإلقاء</span><output>{(speed / 100).toFixed(2)}×</output></span><input type="range" min="70" max="130" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label></div></details>
        <button className="primary-button generate-button" onClick={generateAudio} disabled={isGenerating || !text.trim() || text.length > 5000}><WandSparkles size={18} />{isGenerating ? "جارٍ تجهيز الصوت…" : "توليد الصوت"}<span className="button-shortcut">{isGenerating ? <AudioWaveform size={16} /> : <ArrowLeft size={16} />}</span></button>
        {error && <p className="inline-message error-message" role="alert">{error}</p>}{notice && <p className="inline-message notice-message" role="status">{notice}</p>}
      </div>
      <aside className="preview-column"><div className={`preview-card ${audioUrl || demoMode ? "preview-ready" : ""}`}><div className="preview-topline"><span><Headphones size={15} /> معاينة الصوت</span><span className="live-indicator">{audioUrl || demoMode ? "جاهز" : "بانتظارك"}</span></div><div className="wave-art" aria-hidden="true">{Array.from({ length: 32 }, (_, index) => <span key={index} />)}</div><div className="preview-voice"><span className="voice-avatar">{selectedVoice.name.slice(0, 1)}</span><span><strong>{selectedVoice.name}</strong><small>{selectedVoice.detail}</small></span><button className="icon-button" aria-label="اختيار صوت آخر" onClick={() => document.getElementById("voice-select")?.focus()}><ChevronDown size={16} /></button></div>
        {audioUrl ? <audio ref={audioRef} className="audio-player" src={audioUrl} controls /> : demoMode ? <button className="play-demo" onClick={playDemo}><span className="play-icon">{isSpeaking ? <X size={18} /> : <Play size={18} fill="currentColor" />}</span>{isSpeaking ? "إيقاف المعاينة" : "استمع إلى المعاينة"}</button> : <div className="preview-empty"><span><AudioWaveform size={19} /></span><p>سيظهر مشغّل الصوت هنا<br /><small>بعد توليد أول مقطع</small></p></div>}
        <div className="preview-actions"><a className={`secondary-button download-button ${!audioUrl ? "is-disabled" : ""}`} href={audioUrl || undefined} download="vocalaba-audio.mp3" aria-disabled={!audioUrl} onClick={(event) => { if (!audioUrl) { event.preventDefault(); setNotice("تنزيل MP3 متاح بعد إعداد ElevenLabs."); } }}><ArrowDownToLine size={16} /> تنزيل MP3</a><button className="secondary-button" onClick={shareAudio} disabled={!audioUrl && !demoMode}><Share2 size={16} /> مشاركة</button></div></div>
        <div className="usage-card"><div className="usage-heading"><span><LayoutDashboard size={15} /> رصيدك الشهري</span><span>مجاني</span></div><div className="usage-value"><strong>{history.reduce((sum, item) => sum + item.text.length, 0).toLocaleString("ar")}</strong><span> / ١٠٬٠٠٠ حرف</span></div><div className="usage-track"><span style={{ width: `${Math.min(history.reduce((sum, item) => sum + item.text.length, 0) / 100, 100)}%` }} /></div><button className="upgrade-link" onClick={() => setSection("billing")}>ترقية الخطة <ArrowLeft size={14} /></button></div>
        <div className="tip-card"><span className="tip-icon"><Sparkles size={16} /></span><p><strong>نصيحة للصوت</strong><br />استخدم علامات الترقيم لإيقاع طبيعي وتوقفات أوضح.</p></div></aside></section>;
  }

  return <main className="app-shell" dir="rtl">
    <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}><a href="#top" className="brand-lockup" aria-label="Vocalaba، الصفحة الرئيسية"><span className="brand-mark"><AudioWaveform size={20} /></span><span>vocalaba<span className="brand-dot">.</span><small>مساحة الصوت الذكي</small></span></a><div className="workspace-switch"><span className="workspace-symbol">V</span><span><strong>مساحة عملي</strong><small>الخطة المجانية</small></span><ChevronDown size={15} /></div><p className="nav-caption">مساحة العمل</p><nav className="side-navigation" aria-label="التنقل الرئيسي">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${section === id ? "nav-active" : ""}`} onClick={() => { setSection(id); setMobileNavOpen(false); }}><Icon size={17} /><span>{label}</span>{id === "history" && history.length > 0 && <span className="nav-count">{history.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-plan"><span className="plan-icon"><Sparkles size={16} /></span><strong>اكتشف الخطة الاحترافية</strong><p>أصوات أكثر. مساحة أكبر.</p><button onClick={() => setSection("billing")}>استكشف الخطط <ArrowLeft size={14} /></button></div><button className="help-link" onClick={() => setNotice("تواصل معنا عبر support@vocalaba.example")}><CircleHelp size={16} /> مركز المساعدة</button><button className="profile-button" onClick={() => { setAuthMode("login"); setShowAuth(true); }}><span className="profile-avatar"><UserRound size={16} /></span><span><strong>زائر</strong><small>سجّل الدخول لحفظ عملك</small></span><MoreHorizontal size={17} /></button></div></aside>
    {mobileNavOpen && <button className="nav-scrim" aria-label="إغلاق القائمة" onClick={() => setMobileNavOpen(false)} />}
    <div className="main-area" id="top"><header className="topbar"><button className="mobile-menu icon-button" aria-label="فتح القائمة" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>مساحة عملي</span><ArrowLeft size={13} /><strong>{navigation.find((item) => item.id === section)?.label}</strong></div><div className="topbar-actions"><span className="status-pill"><span /> جميع الأنظمة تعمل</span><button className="topbar-help icon-button" aria-label="المساعدة" onClick={() => setNotice("تواصل معنا عبر support@vocalaba.example")}><CircleHelp size={17} /></button><button className="login-button" onClick={() => { setAuthMode("signup"); setShowAuth(true); }}><UserRound size={15} /> ابدأ مجانًا</button></div></header>
      <div className="page-content"><section className="welcome-row"><div><p className="eyebrow"><span /> استوديو الصوت العربي</p><h1>{section === "studio" ? <>حوّل نصوصك إلى<br className="mobile-break" /> <span>أصوات خارقة.</span></> : navigation.find((item) => item.id === section)?.label}</h1><p className="welcome-copy">{section === "studio" ? "صوت طبيعي يقرّب فكرتك من الناس. اكتب، اختر صوتك، ودع الباقي علينا." : "كل أدواتك الصوتية في مساحة عمل واحدة."}</p></div><div className="welcome-actions"><button className="quiet-button" onClick={() => setSection("history")}><History size={16} /> آخر التسجيلات</button><button className="circle-help" aria-label="مساعدة" onClick={() => setNotice("اكتب نصًا في الاستوديو، ثم اختر الصوت المناسب.")}><CircleHelp size={17} /></button></div></section>
        {renderContent()}
        {section === "studio" && <><section className="features-strip" aria-label="مميزات Vocalaba"><div className="feature-item"><span className="feature-icon feature-languages"><AudioLines size={17} /></span><span><strong>أصوات بلغات متعددة</strong><small>عربي وإنجليزي، بنبرات طبيعية</small></span></div><div className="feature-item"><span className="feature-icon feature-clone"><Mic2 size={17} /></span><span><strong>صوت يشبهك</strong><small>أنشئ صوتًا مخصصًا لمحتواك</small></span></div><div className="feature-item"><span className="feature-icon feature-quality"><Volume2 size={17} /></span><span><strong>جودة تليق بفكرتك</strong><small>صوت واضح لكل منصة</small></span></div></section><section className="bottom-cta"><div><span className="section-kicker"><Sparkles size={14} /> لك مساحة أكبر</span><h2>صوتك يستحق أكثر.</h2><p>ابدأ مجانًا، وانتقل إلى Pro عندما تكون جاهزًا.</p></div><button className="primary-button" onClick={() => setSection("billing")}>قارن الخطط <ArrowLeft size={16} /></button></section></>}
        <footer className="app-footer"><span>© 2026 Vocalaba</span><span><button onClick={() => setNotice("سياسة الخصوصية قيد الإعداد.")}>الخصوصية</button><button onClick={() => setNotice("تواصل معنا عبر support@vocalaba.example")}>الدعم</button></span><span className="footer-version">صُنع للصوت العربي <AudioWaveform size={13} /></span></footer>
      </div>
    </div>
    {showAuth && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAuth(false); }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close icon-button" aria-label="إغلاق" onClick={() => setShowAuth(false)}><X size={18} /></button><span className="modal-brand"><AudioWaveform size={20} /></span><p className="section-kicker">مساحة Vocalaba الخاصة بك</p><h2 id="auth-title">{authMode === "signup" ? "ابدأ حكايتك الصوتية" : "أهلًا بعودتك"}</h2><p className="section-copy">سجّل الدخول لحفظ أصواتك ومتابعة رصيدك.</p><form onSubmit={submitAuth}><label>البريد الإلكتروني<input type="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></label><label>كلمة المرور<input type="password" required minLength={8} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="٨ أحرف على الأقل" autoComplete={authMode === "signup" ? "new-password" : "current-password"} /></label><button className="primary-button" type="submit" disabled={isAuthLoading}>{isAuthLoading ? "جارٍ التحقق…" : authMode === "signup" ? "إنشاء حساب" : "تسجيل الدخول"} <ArrowLeft size={16} /></button></form>{error && <p className="inline-message error-message" role="alert">{error}</p>}<div className="auth-divider"><span>أو</span></div><button className="google-button" onClick={signInWithGoogle}><span className="google-g">G</span> المتابعة باستخدام Google</button><p className="auth-switch">{authMode === "signup" ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"} <button onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}>{authMode === "signup" ? "سجّل الدخول" : "أنشئ حسابًا"}</button></p></section></div>}
    {notice && <div className="toast-message" role="status"><Check size={16} />{notice}<button aria-label="إغلاق التنبيه" onClick={() => setNotice("")}><X size={15} /></button></div>}
  </main>;
}
