import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ORCH_PARTS } from "../constants";
import "../App.css";

type SeatMap = {
  rows: number;
  cols: number;
  backside: boolean;
  assignments: Record<string, string | null>;
};
type SessionV2 = {
  id: string;
  date: string;
  time: string;
  venue: string;
  parts: Record<string, SeatMap>;
};
type PracticeDataV2 = {
  roster: string[];
  sessions: SessionV2[];
  updatedAt: string;
};

const SET_SLUG = "default-sample";
const DEMO =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

const newId = (p: string) =>
  `${p}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`;

function buildEmptyAssignments(rows: number, cols: number) {
  const a: Record<string, string | null> = {};
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) a[`r${r}c${c}`] = null;
  return a;
}

function blankSeatMap(rows = 5, cols = 10): SeatMap {
  return {
    rows,
    cols,
    backside: false,
    assignments: buildEmptyAssignments(rows, cols),
  };
}

function migrateToV2(raw: any): PracticeDataV2 {
  const base: PracticeDataV2 = {
    roster: Array.isArray(raw?.roster) ? raw.roster : [],
    sessions: [],
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
  };

  const sessions: any[] = Array.isArray(raw?.sessions) ? raw.sessions : [];

  for (const s of sessions) {
    if (s?.parts && typeof s.parts === "object") {
      const parts: Record<string, SeatMap> = { ...s.parts };
      for (const name of ORCH_PARTS) {
        if (!parts[name]) parts[name] = blankSeatMap();
      }
      base.sessions.push({
        id: s.id ?? newId("pr"),
        date: s.date ?? "",
        time: s.time ?? "",
        venue: s.venue ?? "",
        parts,
      });
    } else {
      const rows = Number(s?.rows) || 5;
      const cols = Number(s?.cols) || 10;
      const backside = !!s?.backside;
      const src = s?.assignments && typeof s.assignments === "object"
        ? s.assignments
        : buildEmptyAssignments(rows, cols);

      const parts: Record<string, SeatMap> = {};
      for (const name of ORCH_PARTS) {
        parts[name] = {
          rows,
          cols,
          backside,
          assignments: { ...src },
        };
      }
      base.sessions.push({
        id: s.id ?? newId("pr"),
        date: s.date ?? "",
        time: s.time ?? "",
        venue: s.venue ?? "",
        parts,
      });
    }
  }
  return base;
}

async function loadFromSupabase(): Promise<PracticeDataV2 | null> {
  const { data, error } = await supabase
    .from("practice_data")
    .select("data")
    .eq("set_slug", SET_SLUG)
    .maybeSingle();
  if (error) {
    console.error("[practice load]", error);
    return null;
  }
  if (!data?.data) return null;
  return migrateToV2(data.data);
}

async function saveToSupabase(payload: PracticeDataV2): Promise<boolean> {
  const { error } = await supabase
    .from("practice_data")
    .upsert({ set_slug: SET_SLUG, data: payload });
  if (error) {
    console.error("[practice save]", error);
    alert("保存に失敗しました: " + error.message);
    return false;
  }
  return true;
}

function loadFromLocal(): PracticeDataV2 | null {
  try {
    const raw = localStorage.getItem(`practice_data:${SET_SLUG}`);
    return raw ? migrateToV2(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function saveToLocal(payload: PracticeDataV2) {
  localStorage.setItem(`practice_data:${SET_SLUG}`, JSON.stringify(payload));
}

export default function PracticePage() {
  const [canEdit, setCanEdit] = useState(false);
  const [data, setData] = useState<PracticeDataV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [activeName, setActiveName] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newVenue, setNewVenue] = useState("");
  const [newRows, setNewRows] = useState(5);
  const [newCols, setNewCols] = useState(10);
  const seatAreaRef = useRef<HTMLDivElement | null>(null);

  // 権限チェック
  useEffect(() => {
    (async () => {
      const mode = localStorage.getItem('appMode');
      
      // ゲストモードは強制的に閲覧専用
      if (mode === 'guest' || DEMO) {
        setCanEdit(false);
        return;
      }

      // 編集モードの場合のみ、Supabaseで権限確認
      if (mode === 'editor' && !DEMO) {
        const { data: s } = await supabase.auth.getSession();
        const sess = s?.session ?? null;
        const email = sess?.user?.email ?? null;
        if (email) {
          const { data: editors, error } = await supabase
            .from("allowed_editors")
            .select("email")
            .eq("set_slug", SET_SLUG);
          if (error) console.error("[allowed_editors]", error);
          setCanEdit(!!editors?.some((e) => e.email === email));
        } else {
          setCanEdit(false);
        }
      } else {
        setCanEdit(false);
      }
    })();
  }, []);

  // データ読み込み
  useEffect(() => {
    (async () => {
      setLoading(true);
      let base = DEMO ? loadFromLocal() : await loadFromSupabase();
      if (!base) {
        base = {
          roster: [],
          sessions: [],
          updatedAt: new Date().toISOString(),
        };
      } else {
        for (const s of base.sessions) {
          for (const name of ORCH_PARTS) {
            if (!s.parts[name]) s.parts[name] = blankSeatMap();
          }
          if (typeof s.time !== "string") s.time = "";
        }
      }
      setData(base);

      if (base.sessions.length) {
        setSelectedSessionId(base.sessions[0].id);
        setSelectedPart(null);
      }
      setLoading(false);
    })();
  }, []);

  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);
  const roster = useMemo(() => data?.roster ?? [], [data?.roster]);

  const selectedSession = useMemo<SessionV2 | null>(() => {
    if (!data || !selectedSessionId) return null;
    return data.sessions.find((s) => s.id === selectedSessionId) ?? null;
  }, [data, selectedSessionId]);

  const persist = async (next: PracticeDataV2) => {
    next.updatedAt = new Date().toISOString();
    setData(next);
    if (DEMO) saveToLocal(next);
    else await saveToSupabase(next);
  };

  const addName = async () => {
    if (!canEdit) return;
    const name = nameInput.trim();
    if (!name) return;
    const next = structuredClone(data!) as PracticeDataV2;
    if (!next.roster.includes(name)) next.roster.push(name);
    await persist(next);
    setNameInput("");
  };

  const removeName = async (name: string) => {
    if (!canEdit) return;
    const next = structuredClone(data!) as PracticeDataV2;
    next.roster = next.roster.filter((n) => n !== name);
    for (const s of next.sessions) {
      for (const part of Object.values(s.parts)) {
        Object.keys(part.assignments).forEach((k) => {
          if (part.assignments[k] === name) part.assignments[k] = null;
        });
      }
    }
    await persist(next);
    if (activeName === name) setActiveName(null);
  };

  const createSession = async () => {
    if (!canEdit) return;
    const d = newDate.trim();
    const t = newTime.trim();
    const v = newVenue.trim();
    if (!d || !v) {
      alert("日程と会場を入力してください（時間は任意）");
      return;
    }
    const rows = Math.max(1, Math.min(20, Number(newRows) || 1));
    const cols = Math.max(1, Math.min(30, Number(newCols) || 1));
    const parts: Record<string, SeatMap> = {};
    for (const name of ORCH_PARTS) parts[name] = blankSeatMap(rows, cols);

    const s: SessionV2 = {
      id: newId("pr"),
      date: d,
      time: t,
      venue: v,
      parts,
    };
    const next = structuredClone(data!) as PracticeDataV2;
    next.sessions.unshift(s);
    await persist(next);

    setSelectedSessionId(s.id);
    setSelectedPart(null);
    setNewDate("");
    setNewTime("");
    setNewVenue("");
    setNewRows(5);
    setNewCols(10);
  };

  const deleteSession = async (sid: string) => {
    if (!canEdit) return;
    if (!confirm("この練習会を削除しますか？")) return;
    const next = structuredClone(data!) as PracticeDataV2;
    next.sessions = next.sessions.filter((x) => x.id !== sid);
    await persist(next);
    if (selectedSessionId === sid) {
      setSelectedSessionId(next.sessions[0]?.id ?? null);
      setSelectedPart(null);
    }
  };

  const toggleBackside = async () => {
    if (!canEdit || !selectedSession || !selectedPart) return;
    const next = structuredClone(data!) as PracticeDataV2;
    const sm = next.sessions.find((x) => x.id === selectedSession.id)!.parts[selectedPart]!;
    sm.backside = !sm.backside;
    await persist(next);
  };

  const tapSeat = async (seatKey: string) => {
    if (!canEdit || !selectedSession || !selectedPart) return;
    const next = structuredClone(data!) as PracticeDataV2;
    const sm = next.sessions.find((x) => x.id === selectedSession.id)!.parts[selectedPart]!;
    if (!activeName) {
      sm.assignments[seatKey] = null;
    } else {
      Object.keys(sm.assignments).forEach((k) => {
        if (sm.assignments[k] === activeName) sm.assignments[k] = null;
      });
      sm.assignments[seatKey] = activeName;
    }
    await persist(next);
  };

  useEffect(() => {
    if (selectedPart && seatAreaRef.current) {
      seatAreaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedPart]);

  const sessionLabel = (s: SessionV2) =>
    `日程：${s.date || "-"}　時間：${s.time || "-"}　（${s.venue || "会場未設定"}）`;

  const currentMode = localStorage.getItem("appMode");
  const modeLabel = currentMode === "editor" ? "編集モード" : "閲覧モード";
  
  // 表示用（確認のため）

  return (
    <div style={{ padding: 16, maxWidth: 1120, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Orchestra Practice</h2>
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <Link to="/app" style={{ textDecoration: "underline" }}>← Appへ</Link>
        <span style={{ fontSize: 12, color: canEdit ? "#059669" : "#6b7280" }}>
          {modeLabel}{!canEdit && "（編集不可）"}
        </span>
      </div>

      {DEMO && (
        <p className="text-xs" style={{ color: "#6b7280", marginBottom: 12 }}>
          ※ デモモード：Supabase 未設定のため localStorage に保存します（共有はされません）
        </p>
      )}

      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <>
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>概要</div>
            <p style={{ color: "#6b7280", margin: 0 }}>
              「練習会」から<strong>日程・時間・会場</strong>を登録し、セッションボタン（
              <strong>日程：… 時間：…（会場）</strong>）を押す → <strong>パート選択</strong> → 座席（表/裏）を編集します。
              {canEdit && <>上部の<strong>名簿</strong>から名前を選んで座席をタップすると割り当てできます。</>}
            </p>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>練習会</div>

            {sessions.length === 0 ? (
              <div style={{ color: "#6b7280", marginBottom: 12 }}>まだ練習会がありません。</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                {sessions.map((s) => {
                  const opened = selectedSessionId === s.id;
                  return (
                    <div key={s.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                      <button
                        onClick={() => {
                          setSelectedSessionId(opened ? null : s.id);
                          setSelectedPart(null);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "12px 12px",
                          background: opened ? "#eff6ff" : "#f9fafb",
                          borderBottom: "1px solid #e5e7eb",
                          fontWeight: 800,
                          color: opened ? "#1d4ed8" : "#111827",
                        }}
                      >
                        {sessionLabel(s)}
                      </button>

                      {opened && (
                        <div style={{ padding: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>パートを選択</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {ORCH_PARTS.map((p) => (
                              <button
                                key={p}
                                onClick={() => setSelectedPart(p)}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 999,
                                  background: selectedPart === p ? "#e0e7ff" : "#f3f4f6",
                                  border: `1px solid ${selectedPart === p ? "#c7d2fe" : "#e5e7eb"}`,
                                  fontWeight: 700,
                                }}
                              >
                                {p}
                              </button>
                            ))}
                          </div>

                          {selectedPart && (
                            <div ref={seatAreaRef} style={{ marginTop: 12 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  marginBottom: 8,
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ fontWeight: 800 }}>
                                  {selectedPart} / {s.parts[selectedPart].rows} × {s.parts[selectedPart].cols} /{" "}
                                  {s.parts[selectedPart].backside ? "裏" : "表"}
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {canEdit && (
                                    <>
                                      <button
                                        onClick={toggleBackside}
                                        style={{
                                          padding: "8px 10px",
                                          borderRadius: 10,
                                          background: "#f3f4f6",
                                          border: "1px solid #d1d5db",
                                          fontWeight: 700,
                                        }}
                                      >
                                        {s.parts[selectedPart].backside ? "表にする" : "裏にする"}
                                      </button>
                                      <button
                                        onClick={() => deleteSession(s.id)}
                                        style={{
                                          padding: "8px 10px",
                                          borderRadius: 10,
                                          background: "#fff1f2",
                                          border: "1px solid #fecdd3",
                                          color: "#b91c1c",
                                          fontWeight: 700,
                                        }}
                                      >
                                        この練習会を削除
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: `repeat(${s.parts[selectedPart].cols}, minmax(44px, 1fr))`,
                                  gap: 6,
                                }}
                              >
                                {(() => {
                                  const sm = s.parts[selectedPart];
                                  const arr = [...Array(sm.rows).keys()];
                                  const rowsOrder = sm.backside ? arr.reverse() : arr;
                                  return rowsOrder.flatMap((r) =>
                                    [...Array(sm.cols).keys()].map((c) => {
                                      const key = `r${r}c${c}`;
                                      const assigned = sm.assignments[key];
                                      const isActive = activeName && assigned === activeName;
                                      return (
                                        <button
                                          key={key}
                                          onClick={() => canEdit && tapSeat(key)}
                                          disabled={!canEdit}
                                          style={{
                                            height: 44,
                                            borderRadius: 10,
                                            border: `1px solid ${assigned ? "#93c5fd" : "#e5e7eb"}`,
                                            background: assigned
                                              ? isActive
                                                ? "#dbeafe"
                                                : "#eff6ff"
                                              : "#ffffff",
                                            color: assigned ? "#1e3a8a" : "#374151",
                                            fontSize: 12,
                                            padding: "2px 6px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            cursor: canEdit ? "pointer" : "default",
                                            opacity: canEdit ? 1 : 0.7,
                                          }}
                                          title={assigned || "（空席）"}
                                        >
                                          {assigned || "—"}
                                        </button>
                                      );
                                    })
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {canEdit && (
              <>
                <div style={{ fontWeight: 800, margin: "4px 0 6px" }}>練習会を登録</div>
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>日程</div>
                    <input
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      type="date"
                      placeholder="YYYY-MM-DD"
                      style={{
                        width: "100%",
                        padding: "10px 8px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>時間</div>
                    <input
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      type="time"
                      placeholder="HH:MM"
                      style={{
                        width: "100%",
                        padding: "10px 8px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>会場</div>
                    <input
                      value={newVenue}
                      onChange={(e) => setNewVenue(e.target.value)}
                      placeholder="会場名"
                      style={{
                        width: "100%",
                        padding: "10px 8px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>行</div>
                    <input
                      value={newRows}
                      onChange={(e) => setNewRows(Number(e.target.value))}
                      type="number"
                      min={1}
                      max={20}
                      placeholder="行"
                      style={{
                        width: "100%",
                        padding: "10px 8px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>列</div>
                    <input
                      value={newCols}
                      onChange={(e) => setNewCols(Number(e.target.value))}
                      type="number"
                      min={1}
                      max={30}
                      placeholder="列"
                      style={{
                        width: "100%",
                        padding: "10px 8px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </div>

                  <div style={{ alignSelf: "end" }}>
                    <button
                      onClick={createSession}
                      style={{
                        width: "100%",
                        padding: "10px 8px",
                        borderRadius: 10,
                        background: "#111827",
                        color: "#fff",
                        fontWeight: 800,
                      }}
                    >
                      追加
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>名簿</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {roster.length === 0 ? (
                <div style={{ color: "#6b7280" }}>まだ登録がありません。</div>
              ) : (
                roster.map((n) => (
                  <button
                    key={n}
                    onClick={() => canEdit && setActiveName((prev) => (prev === n ? null : n))}
                    disabled={!canEdit}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 999,
                      background: activeName === n ? "#e0e7ff" : "#f3f4f6",
                      border: `1px solid ${activeName === n ? "#c7d2fe" : "#e5e7eb"}`,
                      fontWeight: 700,
                      cursor: canEdit ? "pointer" : "default",
                      opacity: canEdit ? 1 : 0.7,
                    }}
                  >
                    {n}
                  </button>
                ))
              )}
            </div>

            {canEdit && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="名前を追加"
                  style={{
                    padding: "10px 8px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                />
                <button
                  onClick={addName}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#111827",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  追加
                </button>

                {roster.length > 0 && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      marginTop: 6,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {roster.map((n) => (
                      <button
                        key={`del-${n}`}
                        onClick={() => removeName(n)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: "#fff1f2",
                          border: "1px solid #fecdd3",
                          color: "#b91c1c",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {n} を名簿から削除
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
            更新: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-"}
          </div>
        </>
      )}
    </div>
  );
}