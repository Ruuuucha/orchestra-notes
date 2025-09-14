import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Orchestra Notes Manager (single-file React component)
 *
 * 機能:
 *  - ランディング画面（gogo）
 *  - 演奏会→曲→パート 選択
 *  - 注意ポイントの追加/編集/削除（小節・カテゴリ・キュー・本文）
 *  - 検索/カテゴリ絞り込み
 *  - 定型文テンプレ（ワンクリック挿入）
 *  - スコア連携用フィールド（page / pageX / pageY / zoom）※下準備
 *  - 合奏ビュー（同一小節でパート横断表示）
 *  - JSONインポート/エクスポート
 *  - JSON→URL化＆QR共有（#d=base64json）
 *  - 簡易編集制御（許可メール以外は閲覧専用）＆作成者記録
 *  - LocalStorage 永続化
 */

// ---------- 型定義 ----------
export type Note = {
  id: string;
  measureFrom: number;
  measureTo?: number;
  category?: string; // 例: リズム/音程/バランス/テンポ/出だし/終わり/ブレス など
  cue?: string; // cue (合図/参照)
  text: string; // 注意の内容
  // スコア連携の下準備
  page?: number;
  pageX?: number;
  pageY?: number;
  zoom?: number;
  // 監査
  authorEmail?: string;
  authorName?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
};

export type Part = {
  id: string;
  name: string; // 例: Vn1, Vn2, Vla, Vc, Cb, Fl, Ob, Cl, Fg, Hrn, Tp, Tb, Tuba, Perc など
  notes: Note[];
};

export type Piece = {
  id: string;
  title: string;
  composer?: string;
  parts: Part[];
};

export type Concert = {
  id: string;
  name: string; // 例: 第45回定期演奏会
  date?: string; // YYYY-MM-DD
  pieces: Piece[];
};

// ---------- ユーティリティ ----------
const LS_KEY = "orch-notes:v1";
const nowISO = () => new Date().toISOString();
const uuid = () =>
  (globalThis.crypto && "randomUUID" in globalThis.crypto
    ? (globalThis.crypto as any).randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`);

function saveToLS(data: Concert[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function loadFromLS(): Concert[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Concert[];
  } catch (e) {
    console.warn("Failed to load localStorage:", e);
    return null;
  }
}

// 初期データ（例）
const SAMPLE: Concert[] = [
  {
    id: uuid(),
    name: "第45回定期演奏会",
    date: "2025-11-30",
    pieces: [
      {
        id: uuid(),
        title: "ベートーヴェン: 交響曲第5番 ハ短調 Op.67『運命』",
        composer: "L. v. Beethoven",
        parts: [
          {
            id: uuid(),
            name: "Vn1",
            notes: [
              {
                id: uuid(),
                measureFrom: 1,
                measureTo: 4,
                category: "出だし",
                cue: "Tpのモチーフに被せない",
                text: "冒頭の4音は短く切りすぎない。弓は中-先、音価はしっかり。テンポに遅れない。",
                createdAt: nowISO(),
                updatedAt: nowISO(),
              },
              {
                id: uuid(),
                measureFrom: 36,
                category: "リズム",
                cue: "Vaの裏に合わせる",
                text: "シンコペーションの食い込みを揃える。スタッカートは短すぎない。",
                createdAt: nowISO(),
                updatedAt: nowISO(),
              },
            ],
          },
          {
            id: uuid(),
            name: "Tp",
            notes: [
              {
                id: uuid(),
                measureFrom: 1,
                category: "バランス",
                cue: "全体",
                text: "冒頭モチーフは強すぎると弦が埋もれる。客席方向に響きを飛ばし、縦を優先。",
                createdAt: nowISO(),
                updatedAt: nowISO(),
              },
            ],
          },
        ],
      },
      {
        id: uuid(),
        title: "ラヴェル: ボレロ",
        composer: "Maurice Ravel",
        parts: [
          {
            id: uuid(),
            name: "Fl",
            notes: [
              {
                id: uuid(),
                measureFrom: 5,
                category: "音程",
                cue: "Clソロに寄り添う",
                text: "上行の半音は低くならないように。ビブラートは浅めで均一に。",
                createdAt: nowISO(),
                updatedAt: nowISO(),
              },
            ],
          },
        ],
      },
    ],
  },
];

// カテゴリ候補（自由入力も可）
const PRESET_CATEGORIES = [
  "出だし",
  "テンポ",
  "リズム",
  "音程",
  "バランス",
  "強弱",
  "ブレス",
  "終わり",
  "表情",
];

// よく使う定型文テンプレ
const NOTE_TEMPLATES: Array<{label:string; category?:string; cue?:string; text:string}> = [
  { label: "出だし：縦を合わせる", category: "出だし", cue: "全体", text: "出だしの縦を揃える。弓は中-先、短く切りすぎない。" },
  { label: "シンコペ注意", category: "リズム", cue: "Vaの裏", text: "シンコペーションの食い込みを揃える。食い過ぎ注意。" },
  { label: "音程：半音上がり", category: "音程", cue: "Clソロ", text: "半音上行で低くならない。ピッチ高め意識。" },
  { label: "テンポ：走らない", category: "テンポ", cue: "指揮を見る", text: "テンポが走りやすいので縦を優先。クリック感覚で。" },
  { label: "ブレス箇所共有", category: "ブレス", cue: "木管", text: "ブレスは2小節ごとに交互、フレーズ切れに注意。" },
];

const badgeClassForCategory = (cat?: string) => {
  const map: Record<string, string> = {
    '出だし': 'bg-pink-100 text-pink-700 border-pink-200',
    'テンポ': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'リズム': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    '音程': 'bg-amber-100 text-amber-700 border-amber-200',
    'バランス': 'bg-sky-100 text-sky-700 border-sky-200',
    '強弱': 'bg-rose-100 text-rose-700 border-rose-200',
    '終わり': 'bg-violet-100 text-violet-700 border-violet-200',
    'ブレス': 'bg-lime-100 text-lime-700 border-lime-200',
    '表情': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  };
  return 'ml-2 text-xs px-2 py-0.5 rounded-full border ' + (cat && map[cat] ? map[cat] : 'bg-gray-100 text-gray-700 border-gray-200');
};

// ---------- メインコンポーネント ----------
export default function OrchestraNotesApp() {
  const [data, setData] = useState<Concert[]>(() => loadFromLS() ?? SAMPLE);

  // 選択状態
  const [concertId, setConcertId] = useState<string>(data[0]?.id ?? "");
  const [pieceId, setPieceId] = useState<string>(data[0]?.pieces?.[0]?.id ?? "");
  const [partId, setPartId] = useState<string>(
    data[0]?.pieces?.[0]?.parts?.[0]?.id ?? ""
  );

  // UI状態
  const [editMode, setEditMode] = useState<boolean>(true);
  const [filterText, setFilterText] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [ensembleView, setEnsembleView] = useState<boolean>(false);
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [meEmail, setMeEmail] = useState<string>("");
  const [allowedEditors, setAllowedEditors] = useState<string[]>([]);

  useEffect(() => {
    const s = localStorage.getItem('orch-notes:introDismissed');
    if (s === '1') setShowIntro(false);
    const me = localStorage.getItem('orch-notes:meEmail') || "";
    setMeEmail(me);
    const ae = localStorage.getItem('orch-notes:allowedEditors');
    if (ae) try { setAllowedEditors(JSON.parse(ae)); } catch {}
    // URL からデータ読み込み (#d=...)
    try {
      const h = decodeURIComponent(location.hash || "");
      if (h.startsWith('#d=')) {
        const b64 = h.slice(3);
        const json = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
        const imported = JSON.parse(json);
        if (Array.isArray(imported)) {
          setData(imported);
          setConcertId(imported[0]?.id ?? "");
          setPieceId(imported[0]?.pieces?.[0]?.id ?? "");
          setPartId(imported[0]?.pieces?.[0]?.parts?.[0]?.id ?? "");
        }
      }
    } catch {}
  }, []);

  useEffect(() => saveToLS(data), [data]);
  useEffect(() => { localStorage.setItem('orch-notes:allowedEditors', JSON.stringify(allowedEditors)); }, [allowedEditors]);
  useEffect(() => { if (meEmail) localStorage.setItem('orch-notes:meEmail', meEmail); }, [meEmail]);

  // 選択対象の参照
  const currentConcert = useMemo(
    () => data.find((c) => c.id === concertId) || null,
    [data, concertId]
  );
  const currentPiece = useMemo(() => {
    if (!currentConcert) return null;
    return currentConcert.pieces.find((p) => p.id === pieceId) || null;
  }, [currentConcert, pieceId]);
  const currentPart = useMemo(() => {
    if (!currentPiece) return null;
    return currentPiece.parts.find((p) => p.id === partId) || null;
  }, [currentPiece, partId]);

  // 検索/フィルタ（通常ビュー用）
  const filteredNotes = useMemo(() => {
    const notes = currentPart?.notes ?? [];
    return notes
      .filter((n) =>
        filterText
          ? `${n.measureFrom}-${n.measureTo ?? ""} ${n.category ?? ""} ${
              n.cue ?? ""
            } ${n.text}`
              .toLowerCase()
              .includes(filterText.toLowerCase())
          : true
      )
      .filter((n) => (filterCategory ? n.category === filterCategory : true))
      .sort((a, b) => a.measureFrom - b.measureFrom);
  }, [currentPart, filterText, filterCategory]);

  // ---------- CRUD 操作 ----------
  const upsertConcert = (partial: Partial<Concert> & { id?: string }) => {
    setData((prev) => {
      const id = partial.id ?? uuid();
      const idx = prev.findIndex((c) => c.id === id);
      const next: Concert = {
        id,
        name: partial.name ?? "新しい演奏会",
        date: partial.date,
        pieces: partial.pieces ?? [],
      };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...prev[idx], ...next };
        return copy;
      }
      return [...prev, next];
    });
  };

  const upsertPiece = (concertId: string, partial: Partial<Piece> & { id?: string }) => {
    setData((prev) =>
      prev.map((c) => {
        if (c.id !== concertId) return c;
        const id = partial.id ?? uuid();
        const idx = c.pieces.findIndex((p) => p.id === id);
        const next: Piece = {
          id,
          title: partial.title ?? "新しい曲",
          composer: partial.composer,
          parts: partial.parts ?? [],
        };
        if (idx >= 0) {
          const pieces = [...c.pieces];
          pieces[idx] = { ...c.pieces[idx], ...next };
          return { ...c, pieces };
        }
        return { ...c, pieces: [...c.pieces, next] };
      })
    );
  };

  const upsertPart = (
    concertId: string,
    pieceId: string,
    partial: Partial<Part> & { id?: string }
  ) => {
    setData((prev) =>
      prev.map((c) => {
        if (c.id !== concertId) return c;
        const pieces = c.pieces.map((p) => {
          if (p.id !== pieceId) return p;
          const id = partial.id ?? uuid();
          const idx = p.parts.findIndex((pp) => pp.id === id);
          const next: Part = {
            id,
            name: partial.name ?? "新しいパート",
            notes: partial.notes ?? [],
          };
          if (idx >= 0) {
            const parts = [...p.parts];
            parts[idx] = { ...p.parts[idx], ...next };
            return { ...p, parts };
          }
          return { ...p, parts: [...p.parts, next] };
        });
        return { ...c, pieces };
      })
    );
  };

  const upsertNote = (
    concertId: string,
    pieceId: string,
    partId: string,
    partial: Partial<Note> & { id?: string }
  ) => {
    setData((prev) =>
      prev.map((c) => {
        if (c.id !== concertId) return c;
        const pieces = c.pieces.map((p) => {
          if (p.id !== pieceId) return p;
          const parts = p.parts.map((pp) => {
            if (pp.id !== partId) return pp;
            const id = partial.id ?? uuid();
            const idx = pp.notes.findIndex((n) => n.id === id);
            const next: Note = {
              id,
              measureFrom: Number(partial.measureFrom ?? 1),
              measureTo:
                partial.measureTo !== undefined && partial.measureTo !== null
                  ? Number(partial.measureTo)
                  : undefined,
              category: partial.category?.trim() || undefined,
              cue: partial.cue?.trim() || undefined,
              text: partial.text?.trim() || "",
              page: partial.page !== undefined ? Number(partial.page) : undefined,
              pageX: partial.pageX !== undefined ? Number(partial.pageX) : undefined,
              pageY: partial.pageY !== undefined ? Number(partial.pageY) : undefined,
              zoom: partial.zoom !== undefined ? Number(partial.zoom) : undefined,
              authorEmail: partial.authorEmail?.trim() || undefined,
              authorName: partial.authorName?.trim() || undefined,
              createdAt: (partial as any).createdAt ?? nowISO(),
              updatedAt: nowISO(),
            };
            if (idx >= 0) {
              const notes = [...pp.notes];
              notes[idx] = { ...pp.notes[idx], ...next, createdAt: pp.notes[idx].createdAt, updatedAt: nowISO() };
              return { ...pp, notes };
            }
            return { ...pp, notes: [...pp.notes, next] };
          });
          return { ...p, parts };
        });
        return { ...c, pieces };
      })
    );
  };

  const deleteNote = (noteId: string) => {
    if (!currentConcert || !currentPiece || !currentPart) return;
    setData((prev) =>
      prev.map((c) => {
        if (c.id !== currentConcert.id) return c;
        const pieces = c.pieces.map((p) => {
          if (p.id !== currentPiece.id) return p;
          const parts = p.parts.map((pp) => {
            if (pp.id !== currentPart.id) return pp;
            return { ...pp, notes: pp.notes.filter((n) => n.id !== noteId) };
          });
          return { ...p, parts };
        });
        return { ...c, pieces };
      })
    );
  };

  // ---------- フォーム・UI補助 ----------
  const [showAddConcert, setShowAddConcert] = useState(false);
  const [showAddPiece, setShowAddPiece] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  // フォーム入力
  const [fConcertName, setFConcertName] = useState("");
  const [fConcertDate, setFConcertDate] = useState("");

  const [fPieceTitle, setFPieceTitle] = useState("");
  const [fPieceComposer, setFPieceComposer] = useState("");

  const [fPartName, setFPartName] = useState("");

  const [fNoteFrom, setFNoteFrom] = useState<string>("");
  const [fNoteTo, setFNoteTo] = useState<string>("");
  const [fNoteCategory, setFNoteCategory] = useState<string>("");
  const [fNoteCue, setFNoteCue] = useState<string>("");
  const [fNoteText, setFNoteText] = useState<string>("");
  const [fNotePage, setFNotePage] = useState<string>("");
  const [fNoteX, setFNoteX] = useState<string>("");
  const [fNoteY, setFNoteY] = useState<string>("");
  const [fNoteZoom, setFNoteZoom] = useState<string>("");

  // 編集対象（Note）
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const resetNoteForm = () => {
    setFNoteFrom("");
    setFNoteTo("");
    setFNoteCategory("");
    setFNoteCue("");
    setFNoteText("");
    setFNotePage("");
    setFNoteX("");
    setFNoteY("");
    setFNoteZoom("");
    setEditingNote(null);
  };

  const handleSubmitNote = () => {
    if (!currentConcert || !currentPiece || !currentPart) return;
    const base: Partial<Note> = editingNote ? { id: editingNote.id } : {};
    upsertNote(currentConcert.id, currentPiece.id, currentPart.id, {
      ...base,
      measureFrom: Number(fNoteFrom || 1),
      measureTo: fNoteTo ? Number(fNoteTo) : undefined,
      category: fNoteCategory || undefined,
      cue: fNoteCue || undefined,
      text: fNoteText || "",
      page: fNotePage ? Number(fNotePage) : undefined,
      pageX: fNoteX ? Number(fNoteX) : undefined,
      pageY: fNoteY ? Number(fNoteY) : undefined,
      zoom: fNoteZoom ? Number(fNoteZoom) : undefined,
      authorEmail: meEmail || editingNote?.authorEmail,
      createdAt: editingNote?.createdAt,
    });
    setShowAddNote(false);
    resetNoteForm();
  };

  const startEditNote = (n: Note) => {
    setEditingNote(n);
    setFNoteFrom(String(n.measureFrom));
    setFNoteTo(n.measureTo ? String(n.measureTo) : "");
    setFNoteCategory(n.category || "");
    setFNoteCue(n.cue || "");
    setFNoteText(n.text);
    setFNotePage(n.page!==undefined? String(n.page):"");
    setFNoteX(n.pageX!==undefined? String(n.pageX):"");
    setFNoteY(n.pageY!==undefined? String(n.pageY):"");
    setFNoteZoom(n.zoom!==undefined? String(n.zoom):"");
    setShowAddNote(true);
  };

  // インポート/エクスポート
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orchestra_notes_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleImport = async (file: File) => {
    const text = await file.text();
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        setData(arr as Concert[]);
        // 先頭を選択し直す
        setConcertId(arr[0]?.id ?? "");
        setPieceId(arr[0]?.pieces?.[0]?.id ?? "");
        setPartId(arr[0]?.pieces?.[0]?.parts?.[0]?.id ?? "");
      } else {
        alert("JSONは配列（Concert[]）である必要があります。");
      }
    } catch (e) {
      alert("JSONの読み取りに失敗しました。");
    }
  };

  // 共有（JSON→URL化＆QR）
  const openShare = async () => {
    try {
      const json = JSON.stringify(data);
      const b64 = btoa(json).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const url = location.origin + location.pathname + '#d=' + b64;
      setShareUrl(url);
      try {
        const QR = await import('qrcode');
        const u = await QR.toDataURL(url, { width: 240 });
        setQrDataUrl(u);
      } catch {
        setQrDataUrl("");
      }
      setShowShare(true);
    } catch (e) {
      alert('URL化に失敗しました');
    }
  };

  // レイアウト: ヘッダー
  const Header = () => (
    <header className="w-full sticky top-0 z-30 bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <span className="text-xl font-bold">🎻 Orchestra Notes</span>
        {allowedEditors.length > 0 && (!meEmail || !allowedEditors.includes(meEmail)) && (
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">閲覧専用</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setEnsembleView(v => !v)}
            className="px-3 py-1 rounded-full text-sm border border-white/40 hover:bg-white/10"
            title="合奏ビュー切替"
          >{ensembleView ? '通常ビュー' : '合奏ビュー'}</button>
          <button
            onClick={openShare}
            className="px-3 py-1 rounded-full text-sm border border-white/40 hover:bg-white/10"
            title="JSONをURL化してQR共有"
          >共有</button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1 rounded-full text-sm border border-white/40 hover:bg-white/10"
            title="設定（メール/編集者リスト）"
          >設定</button>
          <button
            onClick={() => setEditMode((v) => !v)}
            disabled={allowedEditors.length>0 && (!meEmail || !allowedEditors.includes(meEmail))}
            className={`px-3 py-1 rounded-full text-sm border ${editMode ? "bg-white text-pink-600" : "bg-transparent text-white"} disabled:opacity-50`}
            title="編集モードの切替"
          >
            {editMode ? "編集ON" : "編集OFF"}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1 rounded-full text-sm border border-white/40 hover:bg-white/10"
            title="JSONとしてエクスポート"
          >
            エクスポート
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 rounded-full text-sm border border-white/40 hover:bg-white/10"
            title="JSONからインポート"
          >
            インポート
          </button>
        </span>
      </div>
    </header>
  );

  // ランディング（gogo）
  const OrchestraIllustration = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopColor="#ec4899"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#g)" opacity="0.2"/>
      <rect x="40" y="120" width="120" height="20" rx="10" fill="#8b5cf6" opacity="0.8"/>
      <path d="M70,120 C65,80 140,80 130,120" stroke="#ec4899" strokeWidth="6" fill="none"/>
      <circle cx="70" cy="120" r="6" fill="#ec4899"/>
      <circle cx="130" cy="120" r="6" fill="#ec4899"/>
      <rect x="90" y="60" width="20" height="40" rx="4" fill="#8b5cf6"/>
    </svg>
  );

  const IntroScreen: React.FC = () => (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 via-white to-violet-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur rounded-3xl shadow-2xl border p-8 text-center">
        <div className="mx-auto w-40 h-40 mb-4"><OrchestraIllustration/></div>
        <h1 className="text-2xl font-extrabold tracking-tight">Orchestra Notes</h1>
        <p className="mt-2 text-gray-600">演奏会→曲→パートを選んで、注意ポイントをサクッと管理</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-pink-100 text-pink-700 border">📌 小節メモ</span>
          <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 border">🔎 検索/カテゴリ</span>
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 border">💾 JSON共有</span>
        </div>
        <button onClick={() => { setShowIntro(false); localStorage.setItem('orch-notes:introDismissed','1'); }} className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-full text-white font-semibold shadow-lg bg-gradient-to-r from-pink-500 to-violet-500 hover:opacity-95 active:scale-95 transition">🚀 gogo</button>
      </div>
    </div>
  );

  if (showIntro) return <IntroScreen />;

  // セレクタ群
  const Selectors = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Concert */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-500 mb-1">演奏会</label>
        <div className="flex gap-2">
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={concertId}
            onChange={(e) => {
              setConcertId(e.target.value);
              const c = data.find((cc) => cc.id === e.target.value);
              const p0 = c?.pieces?.[0];
              setPieceId(p0?.id ?? "");
              setPartId(p0?.parts?.[0]?.id ?? "");
            }}
          >
            {data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.date ? `（${c.date}）` : ""}
              </option>
            ))}
          </select>
          {editMode && (
            <button
              className="border rounded-lg px-3"
              onClick={() => {
                setShowAddConcert(true);
                setFConcertName("");
                setFConcertDate("");
              }}
              title="演奏会を追加"
            >＋</button>
          )}
        </div>
      </div>
      {/* Piece */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-500 mb-1">曲</label>
        <div className="flex gap-2">
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={pieceId}
            onChange={(e) => {
              setPieceId(e.target.value);
              const p = currentConcert?.pieces.find((pp) => pp.id === e.target.value);
              setPartId(p?.parts?.[0]?.id ?? "");
            }}
          >
            {(currentConcert?.pieces ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}{p.composer ? `（${p.composer}）` : ""}
              </option>
            ))}
          </select>
          {editMode && (
            <button
              className="border rounded-lg px-3"
              onClick={() => {
                if (!currentConcert) return alert("先に演奏会を選択してください");
                setShowAddPiece(true);
                setFPieceTitle("");
                setFPieceComposer("");
              }}
              title="曲を追加"
            >＋</button>
          )}
        </div>
      </div>
      {/* Part */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-500 mb-1">パート</label>
        <div className="flex gap-2">
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={partId}
            onChange={(e) => setPartId(e.target.value)}
          >
            {(currentPiece?.parts ?? [])
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, "ja"))
              .map((pp) => (
                <option key={pp.id} value={pp.id}>
                  {pp.name}
                </option>
              ))}
          </select>
          {editMode && (
            <button
              className="border rounded-lg px-3"
              onClick={() => {
                if (!currentPiece) return alert("先に曲を選択してください");
                setShowAddPart(true);
                setFPartName("");
              }}
              title="パートを追加"
            >＋</button>
          )}
        </div>
      </div>
    </div>
  );

  // ノート一覧
  const NotesList = () => (
    <div className="mt-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="検索（小節/カテゴリ/内容）…"
            className="border rounded-lg px-3 py-2 w-full md:w-80"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <select
            className="border rounded-lg px-3 py-2"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">カテゴリ（すべて）</option>
            {PRESET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {editMode && (
          <button
            className="border rounded-lg px-3 py-2"
            onClick={() => {
              if (!currentPart) return alert("先にパートを選択してください");
              resetNoteForm();
              setShowAddNote(true);
            }}
            disabled={allowedEditors.length>0 && (!meEmail || !allowedEditors.includes(meEmail))}
          >
            ＋ 注意を追加
          </button>
        )}
      </div>

      {/* 通常ビュー */}
      {!ensembleView && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          {filteredNotes.length === 0 && (
            <div className="border rounded-xl p-6 text-gray-500 text-sm">
              注意はまだありません。
            </div>
          )}
          {filteredNotes.map((n) => (
            <div key={n.id} className="border rounded-xl p-4 bg-white">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">小節</span>
                <span className="font-semibold">
                  {n.measureFrom}
                  {n.measureTo ? `–${n.measureTo}` : ""}
                </span>
                {n.category && (
                  <span className={badgeClassForCategory(n.category)}>{n.category}</span>
                )}
                {n.cue && (
                  <span className="ml-1 text-xs text-gray-500">（{n.cue}）</span>
                )}
                <span className="ml-auto text-[11px] text-gray-400">
                  更新: {new Date(n.updatedAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{n.text}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                {n.page !== undefined && <span>譜面 p.{n.page}</span>}
                {(n.pageX!==undefined || n.pageY!==undefined) && <span>座標 ({n.pageX??'-'},{n.pageY??'-'}) z:{n.zoom??'-'}</span>}
                {n.authorEmail && <span className="underline decoration-dotted" title={`作成者: ${n.authorEmail}${n.authorName? ' / '+n.authorName:''}`}>by {n.authorEmail}</span>}
              </div>
              {editMode && (
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-3 py-1 text-sm border rounded-lg"
                    onClick={() => startEditNote(n)}
                    disabled={allowedEditors.length>0 && (!meEmail || !allowedEditors.includes(meEmail))}
                  >編集</button>
                  <button
                    className="px-3 py-1 text-sm border rounded-lg text-red-600"
                    onClick={() => {
                      if (confirm("この注意を削除しますか？")) deleteNote(n.id);
                    }}
                    disabled={allowedEditors.length>0 && (!meEmail || !allowedEditors.includes(meEmail))}
                  >削除</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 合奏ビュー：同一小節でパート横断 */}
      {ensembleView && currentPiece && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          {(() => {
            const all: Array<{part:string; note: Note}> = [];
            currentPiece.parts.forEach(pp => pp.notes.forEach(n => all.push({part: pp.name, note: n})));
            const groups = new Map<string, Array<{part:string; note:Note}>>();
            all.forEach(({part, note}) => {
              const key = `${note.measureFrom}-${note.measureTo ?? note.measureFrom}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push({part, note});
            });
            const keys = Array.from(groups.keys()).sort((a,b)=>{
              const [af] = a.split('-').map(Number); const [bf] = b.split('-').map(Number); return af-bf;
            });
            if (keys.length===0) return <div className="border rounded-xl p-6 text-gray-500 text-sm">まだ注意がありません。</div>;
            return keys.map(k => {
              const items = groups.get(k)!;
              const [from,to] = k.split('-').map(Number);
              return (
                <div key={k} className="border rounded-xl p-4 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">小節</span>
                    <span className="font-semibold">{from}{to!==from?`–${to}`:''}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.sort((a,b)=>a.part.localeCompare(b.part,'ja')).map(({part, note}) => (
                      <div key={note.id} className="border rounded-lg p-3">
                        <div className="text-sm font-semibold">{part} {note.category && <span className={badgeClassForCategory(note.category)}>{note.category}</span>}</div>
                        {note.cue && <div className="text-xs text-gray-500 mt-1">（{note.cue}）</div>}
                        <div className="mt-1 text-sm whitespace-pre-wrap">{note.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );

  // ダイアログ（簡易）
  const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; }>
    = ({ open, onClose, title, children, footer }) => {
      if (!open) return null;
      return (
        <div className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <div className="relative w-full md:w-[720px] bg-white rounded-t-2xl md:rounded-2xl p-4 shadow-xl">
            <div className="flex items-center">
              <h3 className="text-lg font-semibold">{title}</h3>
              <button className="ml-auto text-sm border rounded-lg px-3 py-1" onClick={onClose}>閉じる</button>
            </div>
            <div className="mt-3">{children}</div>
            {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
          </div>
        </div>
      );
    };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-4 md:py-6">
        <div className="mb-3">
          <Selectors />
        </div>

        {/* 現在のコンテキスト */}
        <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-2">
          <span className="px-2 py-1 rounded-full bg-white border">演奏会: {currentConcert?.name} {currentConcert?.date ? `（${currentConcert.date}）` : ""}</span>
          <span className="px-2 py-1 rounded-full bg-white border">曲: {currentPiece?.title} {currentPiece?.composer ? `（${currentPiece.composer}）` : ""}</span>
          <span className="px-2 py-1 rounded-full bg-white border">パート: {currentPart?.name}</span>
        </div>

        <NotesList />

        {/* ヒント */}
        <div className="mt-6 text-xs text-gray-500 leading-relaxed">
          <p>ヒント: 小節は「開始〜終了」で管理できます（終了が空なら単小節）。カテゴリは自由入力も可能です。インポート/エクスポートでメンバー間共有ができます。</p>
        </div>
      </main>

      {/* 設定: メール/編集者 */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="設定（ユーザー/編集権限）"
        footer={
          <>
            <button className="border rounded-lg px-3 py-1" onClick={()=>setShowSettings(false)}>閉じる</button>
          </>
        }
      >
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-gray-500">あなたのメール（表示/記録用）</label>
            <input className="w-full border rounded-lg px-3 py-2" value={meEmail} onChange={(e)=>setMeEmail(e.target.value)} placeholder="you@example.com"/>
            <div className="text-xs text-gray-500 mt-1">※ ここに入力したメールは注意の作成者として保存されます</div>
          </div>
          <div>
            <label className="text-xs text-gray-500">編集を許可するメール一覧（カンマ区切り）</label>
            <textarea className="w-full border rounded-lg px-3 py-2 min-h-[80px]" value={allowedEditors.join(', ')} onChange={(e)=>setAllowedEditors(e.target.value.split(/[\,\n]/).map(s=>s.trim()).filter(Boolean))} placeholder="a@example.com, b@example.com"/>
            <div className="text-xs text-gray-500 mt-1">※ 空なら全員編集可。入力がある場合、ここに含まれない人は閲覧専用になります。</div>
          </div>
        </div>
      </Modal>

      {/* 共有: JSON→URL & QR */}
      <Modal
        open={showShare}
        onClose={() => setShowShare(false)}
        title="共有リンクとQR"
        footer={
          <>
            <button className="border rounded-lg px-3 py-1" onClick={()=>{navigator.clipboard.writeText(shareUrl);}}>URLをコピー</button>
            <button className="border rounded-lg px-3 py-1" onClick={()=>setShowShare(false)}>閉じる</button>
          </>
        }
      >
        <div className="grid gap-3">
          <input className="w-full border rounded-lg px-3 py-2" value={shareUrl} readOnly />
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR" className="mx-auto"/>
          ) : (
            <div className="text-sm text-gray-500">QR生成ライブラリが読み込めない環境です。URLをコピーして共有してください。</div>
          )}
          <div className="text-xs text-gray-500">このURLを開くと、ページ読込時にデータが読み込まれます（ハッシュ部分 #d=...）。</div>
        </div>
      </Modal>

      {/* モーダル: 演奏会追加 */}
      <Modal
        open={showAddConcert}
        onClose={() => setShowAddConcert(false)}
        title="演奏会を追加"
        footer={
          <>
            <button className="border rounded-lg px-3 py-1" onClick={() => setShowAddConcert(false)}>キャンセル</button>
            <button
              className="border rounded-lg px-3 py-1 bg-black text-white"
              onClick={() => {
                upsertConcert({ name: fConcertName || "新しい演奏会", date: fConcertDate });
                setShowAddConcert(false);
              }}
            >追加</button>
          </>
        }
      >
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-gray-500">名称</label>
            <input className="w-full border rounded-lg px-3 py-2" value={fConcertName} onChange={(e) => setFConcertName(e.target.value)} placeholder="第◯回定期演奏会" />
          </div>
          <div>
            <label className="text-xs text-gray-500">日付（任意）</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2" value={fConcertDate} onChange={(e) => setFConcertDate(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* モーダル: 曲追加 */}
      <Modal
        open={showAddPiece}
        onClose={() => setShowAddPiece(false)}
        title="曲を追加"
        footer={
          <>
            <button className="border rounded-lg px-3 py-1" onClick={() => setShowAddPiece(false)}>キャンセル</button>
            <button
              className="border rounded-lg px-3 py-1 bg-black text-white"
              onClick={() => {
                if (!currentConcert) return;
                const id = uuid();
                upsertPiece(currentConcert.id, { id, title: fPieceTitle || "新しい曲", composer: fPieceComposer });
                setPieceId(id);
                setShowAddPiece(false);
              }}
            >追加</button>
          </>
        }
      >
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-gray-500">タイトル</label>
            <input className="w-full border rounded-lg px-3 py-2" value={fPieceTitle} onChange={(e) => setFPieceTitle(e.target.value)} placeholder="交響曲第5番" />
          </div>
          <div>
            <label className="text-xs text-gray-500">作曲者（任意）</label>
            <input className="w-full border rounded-lg px-3 py-2" value={fPieceComposer} onChange={(e) => setFPieceComposer(e.target.value)} placeholder="L. v. Beethoven" />
          </div>
        </div>
      </Modal>

      {/* モーダル: パート追加 */}
      <Modal
        open={showAddPart}
        onClose={() => setShowAddPart(false)}
        title="パートを追加"
        footer={
          <>
            <button className="border rounded-lg px-3 py-1" onClick={() => setShowAddPart(false)}>キャンセル</button>
            <button
              className="border rounded-lg px-3 py-1 bg-black text-white"
              onClick={() => {
                if (!currentConcert || !currentPiece) return;
                const id = uuid();
                upsertPart(currentConcert.id, currentPiece.id, { id, name: fPartName || "新しいパート" });
                setPartId(id);
                setShowAddPart(false);
              }}
            >追加</button>
          </>
        }
      >
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-gray-500">パート名</label>
            <input className="w-full border rounded-lg px-3 py-2" value={fPartName} onChange={(e) => setFPartName(e.target.value)} placeholder="Vn1 / Fl / Tp など" />
          </div>
        </div>
      </Modal>

      {/* モーダル: 注意の追加/編集 */}
      <Modal
        open={showAddNote}
        onClose={() => { setShowAddNote(false); resetNoteForm(); }}
        title={editingNote ? "注意を編集" : "注意を追加"}
        footer={
          <>
            <button className="border rounded-lg px-3 py-1" onClick={() => { setShowAddNote(false); resetNoteForm(); }}>キャンセル</button>
            <button className="border rounded-lg px-3 py-1 bg-black text-white" onClick={handleSubmitNote} disabled={allowedEditors.length>0 && (!meEmail || !allowedEditors.includes(meEmail))}>
              {editingNote ? "更新" : "追加"}
            </button>
          </>
        }
      >
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">開始小節</label>
            <input
              type="number"
              min={1}
              className="w-full border rounded-lg px-3 py-2"
              value={fNoteFrom}
              onChange={(e) => setFNoteFrom(e.target.value)}
              placeholder="1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">終了小節（任意）</label>
            <input
              type="number"
              min={1}
              className="w-full border rounded-lg px-3 py-2"
              value={fNoteTo}
              onChange={(e) => setFNoteTo(e.target.value)}
              placeholder="未指定なら単小節"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">カテゴリ（任意）</label>
            <input list="catlist" className="w-full border rounded-lg px-3 py-2" value={fNoteCategory} onChange={(e) => setFNoteCategory(e.target.value)} placeholder="リズム/音程/テンポ …" />
            <datalist id="catlist">
              {PRESET_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-xs text-gray-500">キュー/参照（任意）</label>
            <input className="w-full border rounded-lg px-3 py-2" value={fNoteCue} onChange={(e) => setFNoteCue(e.target.value)} placeholder="Tpの刻み/Clソロ/Vaとユニゾン など" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">内容</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 min-h-[120px]"
              value={fNoteText}
              onChange={(e) => setFNoteText(e.target.value)}
              placeholder="具体的に（例: シンコペは食いすぎ注意。冒頭は弓中-先、短すぎない。）"
            />
          </div>
          {/* 定型文（クリックで反映） */}
          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">定型文（クリックで反映）</div>
            <div className="flex flex-wrap gap-2">
              {NOTE_TEMPLATES.map(t => (
                <button key={t.label}
                  className="px-3 py-1 rounded-full border text-sm bg-gray-50 hover:bg-gray-100"
                  onClick={() => {
                    if (t.category) setFNoteCategory(t.category);
                    if (t.cue) setFNoteCue(t.cue);
                    setFNoteText(prev => prev ? (prev + '\n' + t.text) : t.text);
                  }}
                >{t.label}</button>
              ))}
            </div>
          </div>
          {/* スコア連携（下準備） */}
          <div>
            <label className="text-xs text-gray-500">譜面ページ（任意）</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2" value={fNotePage} onChange={(e)=>setFNotePage(e.target.value)} placeholder="1"/>
          </div>
          <div>
            <label className="text-xs text-gray-500">座標X（任意）</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2" value={fNoteX} onChange={(e)=>setFNoteX(e.target.value)} placeholder="px"/>
          </div>
          <div>
            <label className="text-xs text-gray-500">座標Y（任意）</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2" value={fNoteY} onChange={(e)=>setFNoteY(e.target.value)} placeholder="px"/>
          </div>
          <div>
            <label className="text-xs text-gray-500">ズーム（任意）</label>
            <input type="number" step="0.1" className="w-full border rounded-lg px-3 py-2" value={fNoteZoom} onChange={(e)=>setFNoteZoom(e.target.value)} placeholder="1.0"/>
          </div>
        </div>
      </Modal>

      {/* モバイル向けのスペーサー */}
      <div className="h-24" />

      {/* モバイル下部アクションバー */}
      <div className="fixed bottom-3 inset-x-0 px-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto bg-white border shadow-xl rounded-full flex gap-2 px-3 py-2">
          <button
            className={`px-3 py-1 rounded-full text-sm border ${editMode ? "bg-black text-white" : "bg-white"}`}
            onClick={() => setEditMode((v) => !v)}
            disabled={allowedEditors.length>0 && (!meEmail || !allowedEditors.includes(meEmail))}
          >{editMode ? "編集ON" : "編集OFF"}</button>
          <button
            className="px-3 py-1 rounded-full text-sm border"
            onClick={() => {
              if (!currentPart) return alert("先にパートを選択してください");
              resetNoteForm();
              setShowAddNote(true);
            }}
            disabled={allowedEditors.length>0 && (!meEmail || !allowedEditors.includes(meEmail))}
          >＋ 注意</button>
        </div>
      </div>
    </div>
  );
}
