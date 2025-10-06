import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../App.css";

type PartSeats = {
  back: string[];
  front: string[];
};

type SessionV3 = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  seats: {
    Vn1?: PartSeats;
    Vn2?: PartSeats;
    Va?: PartSeats;
    Vc?: PartSeats;
  };
};

type PracticeDataV3 = {
  sessions: SessionV3[];
  updatedAt: string;
};

const SET_SLUG = "default-sample";
const DEMO =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

const SEAT_PARTS = ["Vn1", "Vn2", "Va", "Vc"] as const;
type SeatPart = typeof SEAT_PARTS[number];

const newId = (p: string) =>
  `${p}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`;

function blankPartSeats(): PartSeats {
  return { back: [], front: [] };
}

function migrateToV3(raw: any): PracticeDataV3 {
  const base: PracticeDataV3 = {
    sessions: [],
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
  };

  const sessions: any[] = Array.isArray(raw?.sessions) ? raw.sessions : [];

  for (const s of sessions) {
    base.sessions.push({
      id: s.id ?? newId("pr"),
      date: s.date ?? "",
      startTime: s.startTime ?? s.time ?? "",
      endTime: s.endTime ?? "",
      venue: s.venue ?? "",
      seats: s.seats ?? {},
    });
  }
  return base;
}

async function loadFromSupabase(): Promise<PracticeDataV3 | null> {
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
  return migrateToV3(data.data);
}

async function saveToSupabase(payload: PracticeDataV3): Promise<boolean> {
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

function loadFromLocal(): PracticeDataV3 | null {
  try {
    const raw = localStorage.getItem(`practice_data:${SET_SLUG}`);
    return raw ? migrateToV3(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function saveToLocal(payload: PracticeDataV3) {
  localStorage.setItem(`practice_data:${SET_SLUG}`, JSON.stringify(payload));
}

export default function PracticePage() {
  const [canEdit, setCanEdit] = useState(false);
  const [data, setData] = useState<PracticeDataV3 | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [editingPart, setEditingPart] = useState<SeatPart | null>(null);
  
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newVenue, setNewVenue] = useState("");
  
  const seatAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const mode = localStorage.getItem('appMode');
      
      if (mode === 'guest' || DEMO) {
        setCanEdit(false);
        return;
      }

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      let base = DEMO ? loadFromLocal() : await loadFromSupabase();
      if (!base) {
        base = {
          sessions: [],
          updatedAt: new Date().toISOString(),
        };
      }
      setData(base);

      if (base.sessions.length) {
        setSelectedSessionId(base.sessions[0].id);
      }
      setLoading(false);
    })();
  }, []);

  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);

  const selectedSession = useMemo<SessionV3 | null>(() => {
    if (!data || !selectedSessionId) return null;
    return data.sessions.find((s) => s.id === selectedSessionId) ?? null;
  }, [data, selectedSessionId]);

  const persist = async (next: PracticeDataV3) => {
    next.updatedAt = new Date().toISOString();
    setData(next);
    if (DEMO) saveToLocal(next);
    else await saveToSupabase(next);
  };

  const createSession = async () => {
    if (!canEdit) return;
    const d = newDate.trim();
    const st = newStartTime.trim();
    const et = newEndTime.trim();
    const v = newVenue.trim();
    if (!d || !v) {
      alert("日程と会場を入力してください（時間は任意）");
      return;
    }

    const s: SessionV3 = {
      id: newId("pr"),
      date: d,
      startTime: st,
      endTime: et,
      venue: v,
      seats: {},
    };
    const next = structuredClone(data!) as PracticeDataV3;
    next.sessions.unshift(s);
    await persist(next);

    setSelectedSessionId(s.id);
    setEditingPart(null);
    setNewDate("");
    setNewStartTime("");
    setNewEndTime("");
    setNewVenue("");
  };

  const deleteSession = async (sid: string) => {
    if (!canEdit) return;
    if (!confirm("この練習会を削除しますか？")) return;
    const next = structuredClone(data!) as PracticeDataV3;
    next.sessions = next.sessions.filter((x) => x.id !== sid);
    await persist(next);
    if (selectedSessionId === sid) {
      setSelectedSessionId(next.sessions[0]?.id ?? null);
      setEditingPart(null);
    }
  };

  const addSeat = async (part: SeatPart, side: 'back' | 'front') => {
    if (!canEdit || !selectedSession) return;
    const name = prompt(`名字を入力（${part} ${side === 'back' ? '裏' : '表'}に追加）`)?.trim();
    if (!name) return;
    
    const next = structuredClone(data!) as PracticeDataV3;
    const session = next.sessions.find((x) => x.id === selectedSession.id)!;
    if (!session.seats[part]) session.seats[part] = blankPartSeats();
    session.seats[part]![side].push(name);
    await persist(next);
  };

  const editSeat = async (part: SeatPart, side: 'back' | 'front', index: number) => {
    if (!canEdit || !selectedSession) return;
    const next = structuredClone(data!) as PracticeDataV3;
    const session = next.sessions.find((x) => x.id === selectedSession.id)!;
    if (!session.seats[part]) return;
    
    const currentName = session.seats[part]![side][index];
    const newName = prompt(`名字を編集（${part} ${side === 'back' ? '裏' : '表'} ${index + 1}番）`, currentName)?.trim();
    if (newName === null || newName === undefined) return;
    
    if (newName === '') {
      session.seats[part]![side].splice(index, 1);
    } else {
      session.seats[part]![side][index] = newName;
    }
    await persist(next);
  };

  useEffect(() => {
    if (editingPart && seatAreaRef.current) {
      seatAreaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editingPart]);

  const sessionLabel = (s: SessionV3) => {
    const timeStr = s.startTime && s.endTime 
      ? `${s.startTime}～${s.endTime}` 
      : s.startTime 
      ? `${s.startTime}～` 
      : s.endTime
      ? `～${s.endTime}`
      : "-";
    return `日程：${s.date || "-"}　時間：${timeStr}　（${s.venue || "会場未設定"}）`;
  };

  const currentMode = localStorage.getItem("appMode");
  const modeLabel = currentMode === "editor" ? "編集モード" : "閲覧モード";

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
              {canEdit ? (
                <>「練習会」から<strong>日程・時間・会場</strong>を登録します。座席指定がある場合は各パート（Vn1/Vn2/Va/Vc）の座席を編集できます。</>
              ) : (
                <>各練習会の日程・時間・会場、座席指定がある場合は座席の確認が可能です。</>
              )}
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
                          setEditingPart(null);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "12px 12px",
                          background: opened ? "#eff6ff" : "#f9fafb",
                          borderBottom: opened ? "1px solid #e5e7eb" : "none",
                          fontWeight: 800,
                          color: opened ? "#1d4ed8" : "#111827",
                        }}
                      >
                        {sessionLabel(s)}
                      </button>

                      {opened && (
                        <div style={{ padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontWeight: 700 }}>座席指定</div>
                            {canEdit && (
                              <button
                                onClick={() => deleteSession(s.id)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  background: "#fff1f2",
                                  border: "1px solid #fecdd3",
                                  color: "#b91c1c",
                                  fontWeight: 700,
                                  fontSize: 12,
                                }}
                              >
                                この練習会を削除
                              </button>
                            )}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                            {SEAT_PARTS.map((part) => {
                              const hasSeats = s.seats[part] && (s.seats[part]!.back.length > 0 || s.seats[part]!.front.length > 0);
                              return (
                                <button
                                  key={part}
                                  onClick={() => setEditingPart(editingPart === part ? null : part)}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 999,
                                    background: editingPart === part ? "#e0e7ff" : hasSeats ? "#dbeafe" : "#f3f4f6",
                                    border: `1px solid ${editingPart === part ? "#c7d2fe" : hasSeats ? "#93c5fd" : "#e5e7eb"}`,
                                    fontWeight: 700,
                                    fontSize: 14,
                                  }}
                                >
                                  {part} {hasSeats && "●"}
                                </button>
                              );
                            })}
                          </div>

                          {editingPart && (
                            <div ref={seatAreaRef} style={{ 
                              border: "1px solid #e0e7ff",
                              borderRadius: 12,
                              padding: 12,
                              background: "#f0f9ff"
                            }}>
                              <div style={{ fontWeight: 800, marginBottom: 8 }}>{editingPart} の座席配置</div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "auto 1fr 1fr",
                                  gap: 8,
                                  alignItems: "start",
                                }}
                              >
                                <div style={{ fontWeight: 700, padding: "8px 0" }}></div>
                                <div style={{ fontWeight: 700, textAlign: "center", padding: "8px 0" }}>裏</div>
                                <div style={{ fontWeight: 700, textAlign: "center", padding: "8px 0" }}>表</div>

                                {(() => {
                                  const ps = s.seats[editingPart];
                                  const maxLen = ps ? Math.max(ps.back.length, ps.front.length, 1) : 1;
                                  
                                  return Array.from({ length: maxLen }, (_, i) => (
                                    <React.Fragment key={i}>
                                      <div style={{ fontWeight: 700, padding: "8px 4px" }}>{i + 1}.</div>
                                      
                                      <button
                                        onClick={() => canEdit && (ps?.back[i] ? editSeat(editingPart, 'back', i) : addSeat(editingPart, 'back'))}
                                        disabled={!canEdit}
                                        style={{
                                          padding: "10px 12px",
                                          borderRadius: 8,
                                          border: "1px solid #e5e7eb",
                                          background: ps?.back[i] ? "#eff6ff" : "#fff",
                                          textAlign: "left",
                                          cursor: canEdit ? "pointer" : "default",
                                          opacity: canEdit ? 1 : 0.7,
                                        }}
                                      >
                                        {ps?.back[i] || "—"}
                                      </button>

                                      <button
                                        onClick={() => canEdit && (ps?.front[i] ? editSeat(editingPart, 'front', i) : addSeat(editingPart, 'front'))}
                                        disabled={!canEdit}
                                        style={{
                                          padding: "10px 12px",
                                          borderRadius: 8,
                                          border: "1px solid #e5e7eb",
                                          background: ps?.front[i] ? "#eff6ff" : "#fff",
                                          textAlign: "left",
                                          cursor: canEdit ? "pointer" : "default",
                                          opacity: canEdit ? 1 : 0.7,
                                        }}
                                      >
                                        {ps?.front[i] || "—"}
                                      </button>
                                    </React.Fragment>
                                  ));
                                })()}

                                {canEdit && (
                                  <>
                                    <div></div>
                                    <button
                                      onClick={() => addSeat(editingPart, 'back')}
                                      style={{
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        background: "#f3f4f6",
                                        border: "1px solid #d1d5db",
                                        fontWeight: 700,
                                        fontSize: 12,
                                      }}
                                    >
                                      + 裏に追加
                                    </button>
                                    <button
                                      onClick={() => addSeat(editingPart, 'front')}
                                      style={{
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        background: "#f3f4f6",
                                        border: "1px solid #d1d5db",
                                        fontWeight: 700,
                                        fontSize: 12,
                                      }}
                                    >
                                      + 表に追加
                                    </button>
                                  </>
                                )}
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
                    <div style={{ fontSize: 12, color: "#6b7280" }}>開始時間</div>
                    <input
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
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
                    <div style={{ fontSize: 12, color: "#6b7280" }}>終了時間</div>
                    <input
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
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

          <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
            更新: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-"}
          </div>
        </>
      )}
    </div>
  );
}

import React from "react";