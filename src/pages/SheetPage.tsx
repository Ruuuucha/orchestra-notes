import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../App.css";

/**
 * Supabase: table public.sheet_data (set_slug text PK, data jsonb, updated_at timestamptz)
 * DEMO 環境（.env 未設定）は localStorage に保存します。
 */

type Item = { id: string; label: string; url: string };
type Section = { id: string; name: string; items: Item[] };
type SheetData = { sections: Section[]; updatedAt: string };

const SET_SLUG = "default-sample";
const DEMO =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

const DEFAULT_SECTIONS = ["音源", "各パート譜", "ボウイング"];
const newId = (p: string) =>
  `${p}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`;

async function loadFromSupabase(): Promise<SheetData | null> {
  const { data, error } = await supabase
    .from("sheet_data")
    .select("data")
    .eq("set_slug", SET_SLUG)
    .maybeSingle();
  if (error) {
    console.error("[sheet load] ", error);
    return null;
  }
  return (data?.data as SheetData) ?? null;
}

async function saveToSupabase(payload: SheetData): Promise<boolean> {
  const { error } = await supabase
    .from("sheet_data")
    .upsert({ set_slug: SET_SLUG, data: payload });
  if (error) {
    console.error("[sheet save] ", error);
    alert("保存に失敗しました: " + error.message);
    return false;
  }
  return true;
}

function loadFromLocal(): SheetData | null {
  try {
    const raw = localStorage.getItem(`sheet_data:${SET_SLUG}`);
    return raw ? (JSON.parse(raw) as SheetData) : null;
  } catch {
    return null;
  }
}
function saveToLocal(payload: SheetData) {
  localStorage.setItem(`sheet_data:${SET_SLUG}`, JSON.stringify(payload));
}

export default function SheetPage() {
  // 権限（Notes と同様に allowed_editors を参照）
  const [canEdit, setCanEdit] = useState<boolean>(false);

  // データ
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);

  // 追加UI（折りたたみ）
  const [showAdd, setShowAdd] = useState(false);
  const [useExisting, setUseExisting] = useState<"existing" | "new" | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [customSectionName, setCustomSectionName] = useState("");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  // 初期カテゴリ生成
  const ensureInitial = (base: SheetData | null): SheetData => {
    if (base && base.sections && base.sections.length > 0) return base;
    const sections: Section[] = DEFAULT_SECTIONS.map((n) => ({
      id: newId("sec"),
      name: n,
      items: [],
    }));
    return { sections, updatedAt: new Date().toISOString() };
  };

  // 権限判定（Supabaseの allowed_editors を参照）
  useEffect(() => {
    (async () => {
      if (DEMO) {
        setCanEdit(false);
        return;
      }
      const { data: s } = await supabase.auth.getSession();
      const sess = s?.session ?? null;
      const userEmail = sess?.user?.email ?? null;
      if (userEmail) {
        const { data: editors, error } = await supabase
          .from("allowed_editors")
          .select("email")
          .eq("set_slug", SET_SLUG);
        if (error) console.error("[allowed_editors]", error);
        setCanEdit(!!editors?.some((e) => e.email === userEmail));
      } else {
        setCanEdit(false);
      }
    })();
  }, []);

  // 追加：モードが guest の場合は強制的に閲覧専用（追加UIも非表示）
  const isGuest = localStorage.getItem("appMode") === "guest";
  useEffect(() => {
    if (isGuest) setCanEdit(false);
  }, [isGuest]);

  // データ読み込み
  useEffect(() => {
    (async () => {
      setLoading(true);
      if (DEMO) {
        setData(ensureInitial(loadFromLocal()));
        setLoading(false);
        return;
      }
      const d = await loadFromSupabase();
      setData(ensureInitial(d));
      setLoading(false);
    })();
  }, []);

  const sections = useMemo<Section[]>(
    () => data?.sections ?? [],
    [data?.sections]
  );
  const isDefaultName = (name: string) => DEFAULT_SECTIONS.includes(name);

  // 追加
  const addItem = async () => {
    if (!data) return;
    if (!canEdit) return; // 二重ガード：閲覧モード/権限なしは追加させない

    let targetId: string | null = null;
    const next = structuredClone(data) as SheetData;

    if (useExisting === "existing") {
      targetId = sectionId;
    } else if (useExisting === "new") {
      if (!customSectionName.trim()) {
        alert("新規セクション名を入力してください。");
        return;
      }
      const exists = next.sections.find(
        (s) => s.name.trim() === customSectionName.trim()
      );
      if (exists) {
        targetId = exists.id;
      } else {
        const newSec: Section = {
          id: newId("sec"),
          name: customSectionName.trim(),
          items: [],
        };
        next.sections.push(newSec);
        targetId = newSec.id;
      }
    } else {
      alert("既存セクションを選ぶか、新規セクションを作成してください。");
      return;
    }

    if (!label.trim() || !url.trim()) {
      alert("タイトルとURLを入力してください。");
      return;
    }

    const sec = next.sections.find((s) => s.id === targetId)!;
    sec.items.push({ id: newId("it"), label: label.trim(), url: url.trim() });
    next.updatedAt = new Date().toISOString();

    setData(next);
    if (DEMO) {
      saveToLocal(next);
    } else {
      const ok = await saveToSupabase(next);
      if (!ok) return;
    }

    // リセットして閉じる
    setLabel("");
    setUrl("");
    setCustomSectionName("");
    setSectionId(null);
    setUseExisting(null);
    setShowAdd(false);
  };

  const deleteItem = async (secId: string, itemId: string) => {
    if (!data) return;
    if (!canEdit) return; // 閲覧モードでは削除も不可
    const next = structuredClone(data) as SheetData;
    const sec = next.sections.find((s) => s.id === secId);
    if (!sec) return;
    sec.items = sec.items.filter((i) => i.id !== itemId);
    next.updatedAt = new Date().toISOString();
    setData(next);
    if (DEMO) {
      saveToLocal(next);
    } else {
      await saveToSupabase(next);
    }
  };

  const deleteSection = async (secId: string) => {
    if (!data) return;
    if (!canEdit) return; // 閲覧モードでは削除も不可
    if (!confirm("このセクションを削除しますか？（中のURLも削除されます）")) return;
    const next = structuredClone(data) as SheetData;
    next.sections = next.sections.filter((s) => s.id !== secId);
    next.updatedAt = new Date().toISOString();
    setData(next);
    if (DEMO) {
      saveToLocal(next);
    } else {
      await saveToSupabase(next);
    }
    if (sectionId === secId) setSectionId(null);
  };

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Orchestra Sheet
      </h2>
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <Link to="/app" style={{ textDecoration: "underline" }}>
          ← Appへ
        </Link>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          現在のモード：{isGuest ? "閲覧" : "編集"}
        </span>
      </div>

      {DEMO && (
        <p className="text-xs" style={{ color: "#6b7280", marginBottom: 12 }}>
          ※ デモモード：Supabase 未設定のため localStorage に保存します（共有はされません）
        </p>
      )}

      {/* 既定3つは青系、カスタムはニュートラル */}
      {loading ? (
        <p>読み込み中…</p>
      ) : sections.length === 0 ? (
        <p>リンクはまだありません。</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sections.map((sec) => {
            const isDefault = isDefaultName(sec.name);
            const headerBg = isDefault ? "#eff6ff" : "#f9fafb"; // blue-50 / gray-50
            const headerBorder = isDefault ? "#bfdbfe" : "#e5e7eb"; // blue-200 / gray-200
            const headerTitle = isDefault ? "#1d4ed8" : "#374151"; // blue-700 / gray-700
            const cardBorder = isDefault ? "#bfdbfe" : "#e5e7eb";

            return (
              <div
                key={sec.id}
                style={{
                  border: `1px solid ${cardBorder}`,
                  borderRadius: 12,
                  background: "#fff",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    background: headerBg,
                    borderBottom: `1px solid ${headerBorder}`,
                  }}
                >
                  <div style={{ fontWeight: 800, color: headerTitle }}>
                    {sec.name}
                  </div>
                  {!isGuest && canEdit && (
                    <button
                      onClick={() => deleteSection(sec.id)}
                      style={{
                        fontSize: 12,
                        color: "#ef4444",
                        background: "transparent",
                        border: "none",
                      }}
                    >
                      セクション削除
                    </button>
                  )}
                </div>
                <ul style={{ listStyle: "none", padding: 12, margin: 0 }}>
                  {sec.items.length === 0 ? (
                    <li style={{ color: "#6b7280", fontSize: 14 }}>
                      まだ登録がありません
                    </li>
                  ) : (
                    sec.items.map((it) => (
                      <li
                        key={it.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: "underline" }}
                        >
                          {it.label}
                        </a>
                        {!isGuest && canEdit && (
                          <button
                            onClick={() => deleteItem(sec.id, it.id)}
                            style={{
                              fontSize: 12,
                              color: "#ef4444",
                              background: "transparent",
                              border: "none",
                              marginLeft: 12,
                              flexShrink: 0,
                            }}
                          >
                            削除
                          </button>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* 追加UI：閲覧モードでは完全に非表示 */}
      {!isGuest && canEdit && (
        <>
          <div style={{ height: 16 }} />
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              style={{
                width: "100%",
                padding: "14px 12px",
                borderRadius: 12,
                background: "#ffe4e6", // rose-100
                border: "1px solid #fecdd3", // rose-200
                color: "#9f1239", // rose-800
                fontWeight: 800,
              }}
            >
              ＋ リンクを追加
            </button>
          ) : (
            <div
              style={{
                border: "1px solid #fecdd3", // rose-200
                borderRadius: 12,
                padding: 12,
                marginTop: 4,
                background: "#fff1f2", // rose-50
              }}
            >
              <div style={{ fontWeight: 800, color: "#9f1239", marginBottom: 8 }}>
                リンクを追加
              </div>

              {/* 既存 or 新規 の選択（グレー寄り） */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <button
                  onClick={() => {
                    setUseExisting("existing");
                    setCustomSectionName("");
                  }}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    border:
                      useExisting === "existing"
                        ? "2px solid #4b5563" // gray-600
                        : "1px solid #d1d5db", // gray-300
                    background: useExisting === "existing" ? "#f3f4f6" : "#ffffff", // gray-100 / white
                    color: "#374151", // gray-700
                    fontWeight: 700,
                  }}
                >
                  既存セクションを選ぶ
                </button>
                <button
                  onClick={() => {
                    setUseExisting("new");
                    setSectionId(null);
                  }}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    border:
                      useExisting === "new"
                        ? "2px solid #4b5563"
                        : "1px solid #d1d5db",
                    background: useExisting === "new" ? "#f3f4f6" : "#ffffff",
                    color: "#374151", // gray-700
                    fontWeight: 700,
                  }}
                >
                  新規セクションを作成
                </button>
              </div>

              {/* 選択に応じた UI */}
              {useExisting === "existing" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>
                    既存セクション
                  </label>
                  <select
                    value={sectionId ?? ""}
                    onChange={(e) => setSectionId(e.target.value || null)}
                    style={{
                      width: "100%",
                      padding: "12px 10px",
                      marginTop: 4,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                    }}
                  >
                    <option value="">（選択してください）</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {useExisting === "new" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>
                    新規セクション名
                  </label>
                  <input
                    value={customSectionName}
                    onChange={(e) => setCustomSectionName(e.target.value)}
                    placeholder="例）指揮者メモ"
                    style={{
                      width: "100%",
                      padding: "12px 10px",
                      marginTop: 4,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                </div>
              )}

              {/* 共通：リンク入力 */}
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="タイトル（例：合奏録音 10/12）"
                  style={{
                    width: "100%",
                    padding: "12px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="URL（https://…）"
                  inputMode="url"
                  style={{
                    width: "100%",
                    padding: "12px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    onClick={() => {
                      setLabel("");
                      setUrl("");
                      setCustomSectionName("");
                      setSectionId(null);
                      setUseExisting(null);
                      setShowAdd(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "12px 10px",
                      borderRadius: 10,
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      color: "#374151",
                      fontWeight: 700,
                    }}
                  >
                    キャンセル
                  </button>

                  {/* 追加する（閲覧モードではそもそもここが表示されない） */}
                  <button
                    onClick={addItem}
                    style={{
                      width: "100%",
                      padding: "12px 10px",
                      borderRadius: 10,
                      background: "#b91c1c",
                      border: "1px solid #b91c1c",
                      color: "#ffffff",
                      fontWeight: 800,
                      letterSpacing: 0.2,
                      boxShadow: "0 2px 6px rgba(185,28,28,.25)",
                    }}
                  >
                    追加する
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
        更新: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-"}
      </div>
    </div>
  );
}
