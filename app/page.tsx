"use client";

import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Compass,
  Coffee,
  Copyright,
  Download,
  FileText,
  Grid2X2,
  Heart,
  Info,
  Library,
  List,
  Loader2,
  MessageSquareText,
  Search,
  Settings,
  Sparkles
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type AnyRecord = Record<string, any>;

const BUILT_IN_WEREAD_PROXY_URLS = [
  process.env.NEXT_PUBLIC_WEREAD_PROXY_URL,
  process.env.NEXT_PUBLIC_WEREAD_PROXY_URLS
]
  .filter(Boolean)
  .flatMap((value) => String(value).split(/[,\n]/))
  .map((value) => value.trim())
  .filter(Boolean);
const DEFAULT_WEREAD_PROXY_URL = BUILT_IN_WEREAD_PROXY_URLS[0] || "";
const HAS_BUILT_IN_WEREAD_PROXY = BUILT_IN_WEREAD_PROXY_URLS.length > 0;

type ToolId =
  | "checkin"
  | "search"
  | "shelf"
  | "universe"
  | "notes"
  | "book"
  | "progress"
  | "chapters"
  | "reviews"
  | "discover"
  | "afterword";

type ToolConfig = {
  id: ToolId;
  label: string;
  apiName: string;
  icon: ReactNode;
  description: string;
};

type ShelfItem = {
  id: string;
  type: "book" | "album" | "mp";
  title: string;
  author: string;
  cover: string;
  category: string;
  finished: boolean;
  isTop: boolean;
  secret: boolean;
  updatedAt: number;
  raw: AnyRecord;
};

type NoteNotebook = AnyRecord & {
  bookId?: string;
  book?: AnyRecord;
};

type NoteDetails = {
  notebook: NoteNotebook;
  bookmarkData: unknown;
  reviewData: unknown;
};

type BookLookupResult = {
  __kind: "bookLookup";
  query: string;
  selectedBookId: string;
  searchData: unknown;
  shelfData?: unknown;
  detailData: unknown;
};

type ProgressLookupResult = {
  __kind: "progressLookup";
  query: string;
  selectedBookId: string;
  selectedBook: AnyRecord | null;
  searchData: unknown;
  shelfData?: unknown;
  progressData: unknown;
};

type SearchBookMatch = {
  group: string;
  item: AnyRecord;
  book: AnyRecord;
  bookId: string;
  title: string;
  author: string;
};

type SmartDiscoverResult = {
  __kind: "smartDiscover";
  books: AnyRecord[];
  basis: {
    categories: string[];
    seedBooks: string[];
    shelfBookCount: number;
    hiddenShelfMatches: number;
    sources: string[];
  };
  raw: {
    statsData: unknown;
    shelfData: unknown;
    recommendData: unknown;
    similarData: unknown[];
    searchData: unknown[];
  };
};

type ReadingUniverseProgress = {
  bookId: string;
  data: unknown;
};

type ReadingUniverseResult = {
  __kind: "readingUniverse";
  shelfData: unknown;
  notebooksData: unknown;
  progressItems: ReadingUniverseProgress[];
  progressLimit: number;
  generatedAt: number;
};

type UniverseBook = ShelfItem & {
  noteCount: number;
  reviewCount: number;
  bookmarkCount: number;
  progress?: number;
  readTime?: number;
  finishTime?: number;
  lastReadAt: number;
  keywords: string[];
};

type UniverseLink = {
  source: string;
  target: string;
  weight: number;
  reasons: string[];
};

type DailyCheckinItem = {
  book: ShelfItem;
  highlights: AnyRecord[];
  reviews: AnyRecord[];
};

type DailyCheckinResult = {
  __kind: "dailyCheckin";
  dateKey: string;
  dateLabel: string;
  readSeconds: number;
  items: DailyCheckinItem[];
  fallbackQuote: AnyRecord | null;
  recommendedBooks: ShelfItem[];
  streakDays: number;
  generatedAt: number;
};

type CardTemplate = "minimal" | "paper" | "redbook" | "dark" | "journal";

type NoteCardDraft = {
  id: string;
  bookTitle: string;
  author: string;
  chapterTitle: string;
  meta: string;
  highlight: string;
  thought: string;
};

const cardTemplates: Array<{ id: CardTemplate; label: string }> = [
  { id: "minimal", label: "极简白底" },
  { id: "paper", label: "书页纸张风" },
  { id: "redbook", label: "小红书封面风" },
  { id: "dark", label: "深色阅读风" },
  { id: "journal", label: "手帐风" }
];

const API_KEY_STORAGE = "weread_api_key";
const PROXY_URL_STORAGE = "weread_proxy_url";
const CHECKIN_DATES_STORAGE = "weread_checkin_dates";
const CHECKIN_LAST_POPUP_STORAGE = "weread_checkin_last_popup_date";
const CHECKIN_REFLECTION_STORAGE = "weread_checkin_today_reflection";
const CHECKIN_DISPLAY_NAME_STORAGE = "weread_checkin_display_name";
const UNIVERSE_REVIEWED_STORAGE = "weread_universe_reviewed_books";
const UNIVERSE_MUTED_STORAGE = "weread_universe_muted_books";
const UNIVERSE_PROGRESS_LIMIT = 50;

const tools: ToolConfig[] = [
  {
    id: "checkin",
    label: "每日打卡",
    apiName: "/readdata/detail + /shelf/sync",
    icon: <CalendarCheck size={18} />,
    description: "自动读取今日阅读时长、书籍、划线和想法，生成微信群打卡卡片。"
  },
  {
    id: "search",
    label: "阅读年轮",
    apiName: "/readdata/detail",
    icon: <BarChart3 size={18} />,
    description: "分析阅读热力、类别偏好、习惯趋势，并生成复盘报告。"
  },
  {
    id: "shelf",
    label: "我的书架",
    apiName: "/shelf/sync",
    icon: <Library size={18} />,
    description: "查看电子书、专辑/有声书和文章收藏入口。"
  },
  {
    id: "universe",
    label: "阅读宇宙",
    apiName: "/shelf/sync + /user/notebooks",
    icon: <Sparkles size={18} />,
    description: "把书架里的书按作者、分类、时期和关键词连成阅读银河，并提醒被遗忘的书。"
  },
  {
    id: "notes",
    label: "笔记列表",
    apiName: "/user/notebooks",
    icon: <FileText size={18} />,
    description: "查看笔记本，并直接打开单本书划线与想法。"
  },
  {
    id: "book",
    label: "搜索与书籍详情",
    apiName: "/book/info",
    icon: <BookOpen size={18} />,
    description: "按书名搜索并查看封面、评分、简介、目录和笔记入口。"
  },
  {
    id: "progress",
    label: "阅读进度",
    apiName: "/book/getprogress",
    icon: <CheckCircle2 size={18} />,
    description: "查看单本书当前进度和累计阅读时长。"
  },
  {
    id: "chapters",
    label: "章节目录",
    apiName: "/book/chapterinfo",
    icon: <Settings size={18} />,
    description: "查看章节树和章节跳转链接。"
  },
  {
    id: "reviews",
    label: "书评",
    apiName: "/review/list",
    icon: <MessageSquareText size={18} />,
    description: "查看一本书的公开点评。"
  },
  {
    id: "discover",
    label: "推荐",
    apiName: "/book/recommend",
    icon: <Compass size={18} />,
    description: "获取微信读书个性化推荐。"
  },
  {
    id: "afterword",
    label: "跋",
    apiName: "local",
    icon: <Heart size={18} />,
    description: "项目说明、打赏支持和版权声明。"
  }
];

const scopeOptions = [
  { value: "0", label: "全部" },
  { value: "10", label: "电子书" },
  { value: "16", label: "网文小说" },
  { value: "14", label: "微信听书" },
  { value: "6", label: "作者" },
  { value: "12", label: "全文" },
  { value: "13", label: "书单" },
  { value: "2", label: "公众号" },
  { value: "4", label: "文章" }
];

const modeOptions = [
  { value: "weekly", label: "本周" },
  { value: "monthly", label: "本月" },
  { value: "annually", label: "本年" },
  { value: "overall", label: "总计" }
];

const reviewTypeOptions = [
  { value: "0", label: "全部" },
  { value: "1", label: "推荐" },
  { value: "2", label: "差评" },
  { value: "3", label: "最新" },
  { value: "4", label: "一般" }
];

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function compact(values: Array<string | number | undefined | null | false>) {
  return values.filter(Boolean).join(" · ");
}

function formatDate(value: unknown) {
  if (typeof value !== "number" || value <= 0) return "";
  return new Date(value * 1000).toISOString().slice(0, 10);
}

function formatDateTime(value: unknown) {
  if (typeof value !== "number" || value <= 0) return "";
  return new Date(value * 1000).toLocaleString("zh-CN", { hour12: false });
}

function formatDuration(seconds: unknown) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) return "";
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest}分钟`;
  return `${hours}小时${rest}分钟`;
}

function formatPercent(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return `${Math.round(value * 100)}%`;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return undefined;
}

function entriesFromTimeMap(value: unknown) {
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .map(([key, seconds]) => ({ key, seconds: Number(seconds) || 0 }))
    .sort((a, b) => Number(a.key) - Number(b.key));
}

function normalizeRatio(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return 0;
  return value > 1 ? value / 100 : value;
}

function formatRatio(value: number, fallback = "-") {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return `${Math.round(value * 100)}%`;
}

function formatTimeBucketLabel(key: string) {
  const dateLabel = formatDate(Number(key));
  if (!dateLabel) return key;
  return dateLabel.slice(5) || dateLabel;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateLabel(date = new Date()) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function isTodayTimestamp(value: unknown, dateKey = localDateKey()) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  return localDateKey(new Date(timestamp * 1000)) === dateKey;
}

function firstFiniteNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return undefined;
}

function getTodayReadSeconds(data: unknown, dateKey = localDateKey()) {
  const root = isRecord(data) ? data : {};
  const direct = firstFiniteNumber(
    root.todayReadTime,
    root.todayReadingTime,
    root.dayReadTime,
    root.currentDayReadTime,
    root.readTimeToday
  );
  if (direct !== undefined) return direct;

  const entries = entriesFromTimeMap(root.readTimes);
  const match = entries.find((item) => {
    const numericKey = Number(item.key);
    if (!Number.isFinite(numericKey)) return item.key === dateKey;
    return localDateKey(new Date(numericKey * 1000)) === dateKey;
  });
  return match?.seconds || 0;
}

function getCheckinDates() {
  if (typeof window === "undefined") return [];
  try {
    return asStringArray(JSON.parse(window.localStorage.getItem(CHECKIN_DATES_STORAGE) || "[]"));
  } catch {
    return [];
  }
}

function saveCheckinDate(dateKey: string) {
  if (typeof window === "undefined") return;
  const dates = Array.from(new Set([...getCheckinDates(), dateKey])).sort();
  window.localStorage.setItem(CHECKIN_DATES_STORAGE, JSON.stringify(dates));
}

function getCheckinStreak(dateKey = localDateKey()) {
  const dates = new Set(getCheckinDates());
  let streak = 0;
  const cursor = new Date(`${dateKey}T00:00:00`);
  while (dates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getCheckinReflection(dateKey = localDateKey()) {
  if (typeof window === "undefined") return "";
  try {
    const root = JSON.parse(window.localStorage.getItem(CHECKIN_REFLECTION_STORAGE) || "{}");
    return typeof root[dateKey] === "string" ? root[dateKey] : "";
  } catch {
    return "";
  }
}

function saveCheckinReflection(dateKey: string, text: string) {
  if (typeof window === "undefined") return;
  let root: AnyRecord = {};
  try {
    root = JSON.parse(window.localStorage.getItem(CHECKIN_REFLECTION_STORAGE) || "{}");
  } catch {
    root = {};
  }
  root[dateKey] = text;
  window.localStorage.setItem(CHECKIN_REFLECTION_STORAGE, JSON.stringify(root));
}

function getCheckinDisplayName() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CHECKIN_DISPLAY_NAME_STORAGE) || "";
}

function saveCheckinDisplayName(name: string) {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (trimmed) {
    window.localStorage.setItem(CHECKIN_DISPLAY_NAME_STORAGE, trimmed);
  } else {
    window.localStorage.removeItem(CHECKIN_DISPLAY_NAME_STORAGE);
  }
}

function downloadTextImage(title: string, lines: string[]) {
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = Math.max(720, 180 + lines.length * 44);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#f3f8f1";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(48, 48, width - 96, height - 96);
  ctx.fillStyle = "#081b33";
  ctx.font = "700 44px system-ui, sans-serif";
  ctx.fillText(title, 88, 120);
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillStyle = "#4f5f73";
  lines.forEach((line, index) => {
    ctx.fillText(line, 88, 190 + index * 44);
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${title}.png`;
  link.click();
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const paragraphs = String(text || "").split(/\n+/);
  const lines: string[] = [];
  paragraphs.forEach((paragraph) => {
    let current = "";
    Array.from(paragraph).forEach((char) => {
      const next = current + char;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = char;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
  });
  return lines;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const lines = wrapCanvasText(ctx, text, maxWidth);
  const visible = lines.slice(0, maxLines);
  visible.forEach((line, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? "..." : "";
    ctx.fillText(`${line}${suffix}`, x, y + index * lineHeight);
  });
  return y + visible.length * lineHeight;
}

function getCardPalette(template: CardTemplate) {
  if (template === "dark") {
    return {
      background: "#101827",
      panel: "#182235",
      text: "#f7fbff",
      muted: "#aab7c8",
      highlight: "#2d2445",
      thought: "#183528",
      accent: "#9b8ad8",
      border: "#2f4057"
    };
  }
  if (template === "redbook") {
    return {
      background: "#fff4f6",
      panel: "#ffffff",
      text: "#2b1420",
      muted: "#8a5262",
      highlight: "#ffe2ea",
      thought: "#ecfff0",
      accent: "#ff5c7a",
      border: "#ffd0da"
    };
  }
  if (template === "paper") {
    return {
      background: "#f6efe2",
      panel: "#fffaf0",
      text: "#2d2418",
      muted: "#7b6b58",
      highlight: "#f2e7ff",
      thought: "#edf8df",
      accent: "#9a7b50",
      border: "#e2d3bd"
    };
  }
  if (template === "journal") {
    return {
      background: "#f8f4e9",
      panel: "#fffdf6",
      text: "#203026",
      muted: "#6b756a",
      highlight: "#f0e8ff",
      thought: "#e7f5df",
      accent: "#4d8c73",
      border: "#d8cdb4"
    };
  }
  return {
    background: "#ffffff",
    panel: "#ffffff",
    text: "#14243a",
    muted: "#5e728a",
    highlight: "#f1edff",
    thought: "#edf8ef",
    accent: "#197f96",
    border: "#dbe7f2"
  };
}

function downloadNoteCardImage(
  draft: NoteCardDraft,
  options: {
    template: CardTemplate;
    showBook: boolean;
    showMeta: boolean;
    showSignature: boolean;
    showBrand: boolean;
    signature: string;
  }
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const palette = getCardPalette(options.template);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (options.template === "journal") {
    ctx.strokeStyle = "rgba(77, 140, 115, 0.18)";
    ctx.lineWidth = 2;
    for (let y = 160; y < canvas.height - 120; y += 54) {
      ctx.beginPath();
      ctx.moveTo(96, y);
      ctx.lineTo(canvas.width - 96, y);
      ctx.stroke();
    }
  }

  ctx.fillStyle = palette.panel;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(70, 70, canvas.width - 140, canvas.height - 140, 38);
  ctx.fill();
  ctx.stroke();

  let y = 150;
  const x = 130;
  const width = canvas.width - 260;

  if (options.showBook) {
    ctx.fillStyle = palette.text;
    ctx.font = "700 42px Arial, Microsoft YaHei, sans-serif";
    y = drawWrappedText(ctx, draft.bookTitle, x, y, width, 54, 2) + 16;
    ctx.fillStyle = palette.muted;
    ctx.font = "26px Arial, Microsoft YaHei, sans-serif";
    y = drawWrappedText(ctx, draft.author || "微信读书", x, y, width, 36, 1) + 28;
  }

  if (options.showMeta && draft.meta) {
    ctx.fillStyle = palette.muted;
    ctx.font = "24px Arial, Microsoft YaHei, sans-serif";
    y = drawWrappedText(ctx, draft.meta, x, y, width, 34, 2) + 28;
  }

  if (draft.highlight) {
    ctx.fillStyle = palette.highlight;
    ctx.beginPath();
    ctx.roundRect(x, y, width, 390, 26);
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x, y + 34, 8, 320);
    ctx.fillStyle = palette.text;
    ctx.font = "700 34px SimSun, STSong, serif";
    drawWrappedText(ctx, draft.highlight, x + 34, y + 62, width - 68, 52, 6);
    y += 430;
  }

  if (draft.thought) {
    ctx.fillStyle = palette.thought;
    ctx.beginPath();
    ctx.roundRect(x, y, width, 300, 24);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.font = "30px KaiTi, STKaiti, serif";
    drawWrappedText(ctx, draft.thought, x + 32, y + 58, width - 64, 45, 5);
    y += 340;
  }

  ctx.fillStyle = palette.muted;
  ctx.font = "24px Arial, Microsoft YaHei, sans-serif";
  if (options.showSignature) {
    ctx.fillText(`- ${options.signature || "朝夕阅止"}`, x, canvas.height - 165);
  }
  if (options.showBrand) {
    ctx.strokeStyle = palette.border;
    ctx.strokeRect(canvas.width - 258, canvas.height - 236, 128, 128);
    ctx.fillStyle = palette.accent;
    ctx.font = "700 24px Arial, Microsoft YaHei, sans-serif";
    ctx.fillText("朝夕阅止", canvas.width - 238, canvas.height - 172);
    ctx.fillStyle = palette.muted;
    ctx.font = "18px Arial, Microsoft YaHei, sans-serif";
    ctx.fillText("WeRead Web", canvas.width - 236, canvas.height - 140);
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${sanitizeFileName(draft.bookTitle)}-读书卡片.png`;
  link.click();
}

function downloadDailyCheckinImage(data: DailyCheckinResult, reflection: string, displayName = "") {
  saveCheckinDate(data.dateKey);
  saveCheckinReflection(data.dateKey, reflection);
  saveCheckinDisplayName(displayName);

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const books = data.items.map((item) => item.book.title).filter(Boolean);
  const highlights = data.items.flatMap((item) => item.highlights);
  const reviews = data.items.flatMap((item) => item.reviews);
  const highlightText = String(highlights[0]?.markText || data.fallbackQuote?.markText || "");
  const reviewText = String(getReviewText(reviews[0] || {}) || "");
  const streak = Math.max(data.streakDays, getCheckinStreak(data.dateKey) || 1);
  const displayNameText = displayName.trim().replace(/^@+/, "");

  ctx.fillStyle = "#dff2ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(70, 70, canvas.width - 140, canvas.height - 140, 40);
  ctx.fill();

  ctx.fillStyle = "#197f96";
  ctx.font = "800 36px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("朝夕阅止 · 微信读书打卡", 130, 145);

  ctx.fillStyle = "#14243a";
  ctx.font = "800 58px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(data.dateLabel, 130, 235);

  ctx.fillStyle = "#eaf7ff";
  ctx.beginPath();
  ctx.roundRect(130, 285, 820, 130, 26);
  ctx.fill();
  ctx.fillStyle = "#14243a";
  ctx.font = "800 42px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(formatDuration(data.readSeconds) || "今天还没读书", 170, 365);
  ctx.fillStyle = "#5e728a";
  ctx.font = "24px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText(`连续打卡 ${streak} 天`, 650, 365);

  let y = 485;
  ctx.fillStyle = "#5e728a";
  ctx.font = "700 26px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("今日读过", 130, y);
  y += 48;
  ctx.fillStyle = "#14243a";
  ctx.font = "700 32px Arial, Microsoft YaHei, sans-serif";
  y = drawWrappedText(ctx, books.length ? books.slice(0, 4).join(" / ") : "还没有阅读记录", 130, y, 820, 44, 2) + 44;

  if (highlightText) {
    ctx.fillStyle = "#f1edff";
    ctx.beginPath();
    ctx.roundRect(130, y, 820, 245, 24);
    ctx.fill();
    ctx.fillStyle = "#9b8ad8";
    ctx.fillRect(130, y + 26, 8, 190);
    ctx.fillStyle = "#231b38";
    ctx.font = "700 31px SimSun, STSong, serif";
    drawWrappedText(ctx, highlightText, 164, y + 56, 760, 46, 4);
    y += 290;
  }

  if (reviewText) {
    ctx.fillStyle = "#edf8ef";
    ctx.beginPath();
    ctx.roundRect(130, y, 820, 180, 22);
    ctx.fill();
    ctx.fillStyle = "#244232";
    ctx.font = "28px KaiTi, STKaiti, serif";
    drawWrappedText(ctx, reviewText, 164, y + 52, 760, 42, 3);
    y += 220;
  }

  ctx.fillStyle = "#fff8df";
  ctx.beginPath();
  ctx.roundRect(130, y, 820, 210, 24);
  ctx.fill();
  ctx.fillStyle = "#7a5200";
  ctx.font = "800 26px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("今日感悟", 164, y + 48);
  ctx.fillStyle = "#14243a";
  ctx.font = "30px KaiTi, STKaiti, serif";
  drawWrappedText(ctx, reflection || "把今天读到的一点光，留给明天的自己。", 164, y + 95, 760, 44, 3);

  ctx.fillStyle = "#5e728a";
  ctx.font = "22px Arial, Microsoft YaHei, sans-serif";
  ctx.fillText("数据来自微信读书 · 由朝夕阅止生成", 130, canvas.height - 120);
  if (displayNameText) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#197f96";
    ctx.font = "700 26px Arial, Microsoft YaHei, sans-serif";
    ctx.fillText(`@${displayNameText}`, canvas.width - 130, canvas.height - 120);
    ctx.textAlign = "left";
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${data.dateKey}-微信读书打卡.png`;
  link.click();
}

function formatRating(value: unknown) {
  if (typeof value !== "number" || value <= 0) return "";
  return `${(value / 10).toFixed(1)}分`;
}

function getBookTitle(book: AnyRecord) {
  return book.title || book.name || book.book?.title || book.bookInfo?.title || "未命名";
}

function getBookAuthor(book: AnyRecord) {
  return book.author || book.authorName || book.book?.author || book.bookInfo?.author || "";
}

function getBookId(book: AnyRecord) {
  return String(book.bookId || book.id || book.book?.bookId || book.bookInfo?.bookId || "");
}

function isLikelyBookId(value: string) {
  return /^\d{5,}$/.test(value) || /^cb_/i.test(value);
}

function getNotebookBook(notebook: NoteNotebook) {
  return isRecord(notebook.book) ? notebook.book : notebook;
}

function getNotebookBookId(notebook: NoteNotebook) {
  return String(notebook.bookId || notebook.book?.bookId || "");
}

function getNotebookTotal(notebook: NoteNotebook) {
  return Number(notebook.reviewCount || 0) + Number(notebook.noteCount || 0) + Number(notebook.bookmarkCount || 0);
}

function buildReadingLink(bookId: unknown, chapterUid?: unknown) {
  if (!bookId) return "";
  const base = `weread://reading?bId=${encodeURIComponent(String(bookId))}`;
  if (!chapterUid) return base;
  return `${base}&chapterUid=${encodeURIComponent(String(chapterUid))}`;
}

function openWereadApp(bookId: unknown, chapterUid?: unknown) {
  const appLink = buildReadingLink(bookId, chapterUid);
  if (!appLink) return;
  window.location.href = appLink;
}

function WereadAppLink({
  bookId,
  chapterUid,
  className,
  children
}: {
  bookId: unknown;
  chapterUid?: unknown;
  className?: string;
  children: ReactNode;
}) {
  const appLink = buildReadingLink(bookId, chapterUid);
  if (!appLink) return null;
  return (
    <a
      className={className}
      href={appLink}
      onClick={(event) => {
        event.preventDefault();
        openWereadApp(bookId, chapterUid);
      }}
    >
      {children}
    </a>
  );
}

function normalizeShelfItems(root: AnyRecord): ShelfItem[] {
  const books = asArray(root.books).map((book): ShelfItem => ({
    id: String(book.bookId || ""),
    type: "book",
    title: getBookTitle(book),
    author: getBookAuthor(book),
    cover: String(book.cover || ""),
    category: String(book.category || "未分类"),
    finished: Boolean(book.finishReading),
    isTop: Boolean(book.isTop),
    secret: Boolean(book.secret),
    updatedAt: Number(book.readUpdateTime || book.updateTime || 0),
    raw: book
  }));

  const albums = asArray(root.albums).map((album): ShelfItem => {
    const info = isRecord(album.albumInfo) ? album.albumInfo : album;
    const extra = isRecord(album.albumInfoExtra) ? album.albumInfoExtra : {};
    return {
      id: String(info.albumId || ""),
      type: "album",
      title: String(info.name || "未命名专辑"),
      author: String(info.authorName || ""),
      cover: String(info.cover || ""),
      category: "专辑/有声书",
      finished: Boolean(info.finish),
      isTop: Boolean(extra.isTop),
      secret: Boolean(extra.secret),
      updatedAt: Number(extra.lectureReadUpdateTime || info.updateTime || 0),
      raw: album
    };
  });

  const mp = root.mp
    ? [
        {
          id: "mp",
          type: "mp" as const,
          title: "文章收藏",
          author: "微信读书",
          cover: "",
          category: "文章收藏",
          finished: false,
          isTop: false,
          secret: true,
          updatedAt: 0,
          raw: root.mp
        }
      ]
    : [];

  return [...books, ...albums, ...mp];
}

function mergeShelfRecommendations(items: ShelfItem[]) {
  const seen = new Set<string>();
  const merged: ShelfItem[] = [];
  items.forEach((item) => {
    if (!item.id || seen.has(item.id)) return;
    seen.add(item.id);
    merged.push(item);
  });
  return merged;
}

function extractSearchBookMatches(data: unknown): SearchBookMatch[] {
  const root = isRecord(data) ? data : {};
  const grouped = asArray(root.results).flatMap((group) =>
    asArray(group.books).map((item) => {
      const book = isRecord(item.bookInfo) ? item.bookInfo : item;
      const bookId = getBookId(book);
      return {
        group: String(group.title || `scope ${group.scope ?? ""}`),
        item,
        book,
        bookId,
        title: String(getBookTitle(book)),
        author: String(getBookAuthor(book))
      };
    })
  );
  const direct = asArray(root.books).map((book) => {
    const bookId = getBookId(book);
    return {
      group: "搜索结果",
      item: book,
      book,
      bookId,
      title: String(getBookTitle(book)),
      author: String(getBookAuthor(book))
    };
  });

  return [...grouped, ...direct].filter((match) => match.bookId);
}

function isQueryMatch(book: AnyRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return `${getBookTitle(book)} ${getBookAuthor(book)} ${book.category || ""}`.toLowerCase().includes(normalizedQuery);
}

function extractShelfBookMatches(data: unknown, query: string): SearchBookMatch[] {
  const root = isRecord(data) ? data : {};
  return normalizeShelfItems(root)
    .filter((item) => item.type === "book")
    .map((item) => {
      const book = isRecord(item.raw) ? item.raw : {};
      return {
        group: "我的书架",
        item: book,
        book,
        bookId: item.id,
        title: item.title,
        author: item.author
      };
    })
    .filter((match) => match.bookId && isQueryMatch(match.book, query));
}

function mergeBookMatches(...groups: SearchBookMatch[][]) {
  const seen = new Set<string>();
  const merged: SearchBookMatch[] = [];
  groups.flat().forEach((match) => {
    if (!match.bookId || seen.has(match.bookId)) return;
    seen.add(match.bookId);
    merged.push(match);
  });
  return merged;
}

function mergeBookDetailWithFallback(detailData: unknown, fallbackBook: unknown) {
  const detail = isRecord(detailData) ? detailData : {};
  const fallback = isRecord(fallbackBook) ? fallbackBook : {};
  return {
    ...fallback,
    ...detail,
    bookId: getBookId(detail) || getBookId(fallback),
    title: detail.title || detail.name || fallback.title || fallback.name,
    author: detail.author || detail.authorName || fallback.author || fallback.authorName,
    cover: detail.cover || fallback.cover,
    category: detail.category || fallback.category
  };
}

function normalizeDiscoverBook(book: AnyRecord, source: string, reason?: string) {
  const bookId = getBookId(book);
  if (!bookId) return null;
  return {
    ...book,
    bookId,
    __source: source,
    __smartReason: reason || book.reason || ""
  };
}

function extractDiscoverBooks(data: unknown, source: string) {
  const root = isRecord(data) ? data : {};
  const direct = asArray(root.books)
    .map((book) => normalizeDiscoverBook(book, source, String(book.reason || "")))
    .filter(Boolean) as AnyRecord[];

  const similarRoot = isRecord(root.booksimilar) ? root.booksimilar : {};
  const similar = asArray(similarRoot.books)
    .map((item) => {
      const wrapper = isRecord(item.book) ? item.book : item;
      const book = isRecord(wrapper.bookInfo) ? wrapper.bookInfo : wrapper;
      return normalizeDiscoverBook(book, source, String(item.reason || book.reason || ""));
    })
    .filter(Boolean) as AnyRecord[];

  const search = extractSearchBookMatches(data)
    .map((match) => normalizeDiscoverBook(match.book, source, `来自偏好分类「${match.group}」的相关搜索`))
    .filter(Boolean) as AnyRecord[];

  return [...direct, ...similar, ...search];
}

function getPreferenceCategoryNames(statsData: unknown) {
  const root = isRecord(statsData) ? statsData : {};
  return asArray(root.preferCategory)
    .map((item) => ({
      name: String(item.categoryTitle || item.parentCategoryTitle || "").trim(),
      score: Math.max(Number(item.readingTime) || 0, normalizeRatio(item.val) * 1000, Number(item.readingCount) || 0)
    }))
    .filter((item) => item.name)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.name)
    .filter((name, index, list) => list.indexOf(name) === index)
    .slice(0, 3);
}

function getReadLongestSeeds(statsData: unknown) {
  const root = isRecord(statsData) ? statsData : {};
  return asArray(root.readLongest)
    .map((item) => {
      const book = isRecord(item.book) ? item.book : {};
      const bookId = getBookId(book);
      return {
        book,
        bookId,
        title: getBookTitle(book),
        readTime: Number(item.readTime) || 0
      };
    })
    .filter((item) => item.bookId)
    .sort((a, b) => b.readTime - a.readTime)
    .slice(0, 3);
}

function mergeDiscoverBooks(groups: AnyRecord[][], existingBookIds: Set<string>, limit: number) {
  const seen = new Set<string>();
  const hiddenShelfMatches = { count: 0 };
  const books: AnyRecord[] = [];
  const fallback: AnyRecord[] = [];

  groups.flat().forEach((book) => {
    const bookId = getBookId(book);
    if (!bookId || seen.has(bookId)) return;
    seen.add(bookId);
    if (existingBookIds.has(bookId)) {
      hiddenShelfMatches.count += 1;
      fallback.push(book);
      return;
    }
    books.push(book);
  });

  const finalBooks = books.length ? books : fallback;
  return {
    books: finalBooks.slice(0, limit),
    hiddenShelfMatches: hiddenShelfMatches.count
  };
}

function getNotebookMap(data: unknown) {
  const root = isRecord(data) ? data : {};
  const map = new Map<string, NoteNotebook>();
  asArray(root.books).forEach((notebook) => {
    const bookId = getNotebookBookId(notebook);
    if (bookId) map.set(bookId, notebook as NoteNotebook);
  });
  return map;
}

function getProgressBook(data: unknown) {
  const root = isRecord(data) ? data : {};
  return isRecord(root.book) ? root.book : root;
}

function getProgressPercent(data: unknown) {
  const book = getProgressBook(data);
  const value = firstNumber(book.progress, book.progressRatio, book.readingProgress, book.percent);
  if (value === undefined) return undefined;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function getProgressReadTime(data: unknown) {
  const root = isRecord(data) ? data : {};
  const book = getProgressBook(data);
  return firstNumber(
    book.recordReadingTime,
    root.recordReadingTime,
    book.readingTime,
    root.readingTime,
    book.totalReadTime,
    root.totalReadTime,
    book.readTime,
    root.readTime,
    book.bookReadTime,
    root.bookReadTime
  );
}

function getProgressUpdateTime(data: unknown) {
  const root = isRecord(data) ? data : {};
  const book = getProgressBook(data);
  return firstNumber(book.updateTime, root.updateTime, book.readUpdateTime, root.readUpdateTime, book.lastReadTime, root.lastReadTime);
}

function getBookKeywords(book: ShelfItem) {
  const raw = isRecord(book.raw) ? book.raw : {};
  const text = `${book.title} ${book.author} ${book.category} ${raw.intro || ""}`;
  const words = text
    .split(/[\s,，.。:：;；、/｜|《》<>()[\]{}"'“”‘’!?！？-]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && word.length <= 12);
  return Array.from(new Set([book.category, ...words].filter(Boolean))).slice(0, 12);
}

function monthKey(timestamp: number) {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toISOString().slice(0, 7);
}

function daysSince(timestamp: number) {
  if (!timestamp) return 999;
  return Math.max(0, Math.floor((Date.now() - timestamp * 1000) / 86400000));
}

function buildUniverseBooks(shelfData: unknown, notebooksData: unknown, progressItems: ReadingUniverseProgress[]) {
  const shelfRoot = isRecord(shelfData) ? shelfData : {};
  const notebookMap = getNotebookMap(notebooksData);
  const progressMap = new Map(progressItems.map((item) => [item.bookId, item.data]));

  return normalizeShelfItems(shelfRoot)
    .filter((item) => item.type === "book" && item.id)
    .map((item): UniverseBook => {
      const notebook = notebookMap.get(item.id);
      const progressData = progressMap.get(item.id);
      const progressBook = getProgressBook(progressData);
      const lastReadAt = getProgressUpdateTime(progressData) ?? item.updatedAt;
      const progress = getProgressPercent(progressData);
      return {
        ...item,
        finished: item.finished || Boolean(progressBook.finishReading || progressBook.isFinish || progressBook.finishTime),
        noteCount: Number(notebook?.noteCount || 0),
        reviewCount: Number(notebook?.reviewCount || 0),
        bookmarkCount: Number(notebook?.bookmarkCount || 0),
        progress,
        readTime: getProgressReadTime(progressData),
        finishTime: firstNumber(progressBook.finishTime),
        lastReadAt,
        keywords: getBookKeywords(item)
      };
    });
}

function buildUniverseLinks(books: UniverseBook[]) {
  const links: UniverseLink[] = [];
  for (let i = 0; i < books.length; i += 1) {
    for (let j = i + 1; j < books.length; j += 1) {
      const a = books[i];
      const b = books[j];
      const reasons: string[] = [];
      let weight = 0;

      if (a.author && b.author && a.author === b.author) {
        weight += 5;
        reasons.push("同作者");
      }
      if (a.category && b.category && a.category === b.category) {
        weight += 3;
        reasons.push("同分类");
      }
      if (monthKey(a.lastReadAt) && monthKey(a.lastReadAt) === monthKey(b.lastReadAt)) {
        weight += 2;
        reasons.push("同期阅读");
      }

      const overlap = a.keywords.filter((word) => b.keywords.includes(word));
      if (overlap.length) {
        weight += Math.min(3, overlap.length);
        reasons.push("相似关键词");
      }
      if (a.noteCount + a.reviewCount > 5 && b.noteCount + b.reviewCount > 5) {
        weight += 1;
        reasons.push("都有较多笔记");
      }

      if (weight >= 3) {
        links.push({ source: a.id, target: b.id, weight, reasons: Array.from(new Set(reasons)) });
      }
    }
  }
  return links.sort((a, b) => b.weight - a.weight).slice(0, 120);
}

function isReadingUniverseResult(value: unknown): value is ReadingUniverseResult {
  return isRecord(value) && value.__kind === "readingUniverse";
}

function isDailyCheckinResult(value: unknown): value is DailyCheckinResult {
  return isRecord(value) && value.__kind === "dailyCheckin";
}

function isBookLookupResult(value: unknown): value is BookLookupResult {
  return isRecord(value) && value.__kind === "bookLookup";
}

function isProgressLookupResult(value: unknown): value is ProgressLookupResult {
  return isRecord(value) && value.__kind === "progressLookup";
}

function getChapterTitle(chapters: AnyRecord[], chapterUid: unknown) {
  const match = chapters.find((chapter) => String(chapter.chapterUid) === String(chapterUid));
  return String(match?.title || "未分章节");
}

function extractMineReview(reviewItem: AnyRecord) {
  const wrapper = isRecord(reviewItem.review) ? reviewItem.review : reviewItem;
  return isRecord(wrapper.review) ? wrapper.review : wrapper;
}

function getNoteRange(item: AnyRecord) {
  return String(item.range || item.markRange || item.abstractRange || "").trim();
}

function getReviewText(review: AnyRecord) {
  return String(review.content || review.htmlContent || review.abstract || review.review || "").trim();
}

function noteMatchKey(chapterUid: unknown, range: unknown) {
  return `${String(chapterUid || "")}::${String(range || "")}`;
}

function pairNotes(chapters: AnyRecord[], highlights: AnyRecord[], reviews: AnyRecord[]) {
  const exactReviewMap = new Map<string, AnyRecord[]>();
  const chapterOnlyReviewMap = new Map<string, AnyRecord[]>();
  const unmatchedReviews: AnyRecord[] = [];

  reviews.forEach((review) => {
    const range = getNoteRange(review);
    const chapterUid = review.chapterUid || review.chapter?.chapterUid || "";
    if (chapterUid && range) {
      const key = noteMatchKey(chapterUid, range);
      exactReviewMap.set(key, [...(exactReviewMap.get(key) || []), review]);
      return;
    }
    if (chapterUid) {
      const key = String(chapterUid);
      chapterOnlyReviewMap.set(key, [...(chapterOnlyReviewMap.get(key) || []), review]);
      return;
    }
    unmatchedReviews.push(review);
  });

  const pairs = highlights.map((highlight, index) => {
    const range = getNoteRange(highlight);
    const chapterUid = highlight.chapterUid || "";
    const exactKey = noteMatchKey(chapterUid, range);
    const chapterKey = String(chapterUid);
    const exactReviews = exactReviewMap.get(exactKey) || [];
    const chapterReviews = exactReviews.length ? [] : chapterOnlyReviewMap.get(chapterKey) || [];
    exactReviewMap.delete(exactKey);
    if (!exactReviews.length) chapterOnlyReviewMap.delete(chapterKey);

    return {
      id: String(highlight.bookmarkId || highlight.reviewId || `${chapterUid}-${range}-${index}`),
      chapterTitle: getChapterTitle(chapters, chapterUid),
      chapterUid,
      range,
      createTime: highlight.createTime,
      highlight,
      reviews: [...exactReviews, ...chapterReviews]
    };
  });

  exactReviewMap.forEach((items) => unmatchedReviews.push(...items));
  chapterOnlyReviewMap.forEach((items) => unmatchedReviews.push(...items));

  return { pairs, unmatchedReviews };
}

function exportMarkdown(details: NoteDetails) {
  const book = getNotebookBook(details.notebook);
  const chapters = asArray((details.bookmarkData as AnyRecord)?.chapters);
  const highlights = asArray((details.bookmarkData as AnyRecord)?.updated);
  const reviews = asArray((details.reviewData as AnyRecord)?.reviews).map(extractMineReview);
  const lines = [
    `# ${getBookTitle(book)}`,
    "",
    `作者：${getBookAuthor(book) || "-"}`,
    `导出时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    `统计：${Number(details.notebook.noteCount || 0)} 条划线，${Number(details.notebook.reviewCount || 0)} 条想法/点评，${Number(details.notebook.bookmarkCount || 0)} 个书签`,
    "",
    "## 划线",
    ""
  ];

  highlights.forEach((item) => {
    lines.push(`### ${getChapterTitle(chapters, item.chapterUid)}`);
    lines.push(`- 时间：${formatDateTime(item.createTime) || "-"}`);
    lines.push(`- 位置：${item.range || "-"}`);
    lines.push("");
    lines.push(`> ${String(item.markText || "").replace(/\n/g, "\n> ")}`);
    lines.push("");
  });

  lines.push("## 想法/点评", "");
  reviews.forEach((review) => {
    lines.push(`### ${review.chapterName || "整本书"}`);
    lines.push(`- 时间：${formatDateTime(review.createTime) || "-"}`);
    lines.push("");
    lines.push(String(review.content || review.htmlContent || ""));
    lines.push("");
  });

  return lines.join("\n");
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "weread-notes";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    let code = (crc ^ byte) & 0xff;
    for (let index = 0; index < 8; index += 1) {
      code = code & 1 ? 0xedb88320 ^ (code >>> 1) : code >>> 1;
    }
    crc = (crc >>> 8) ^ code;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function createZip(files: Array<{ path: string; content: string | Uint8Array }>) {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path);
    const contentBytes = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
    const crc = crc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, dosTime);
    writeUint16(localView, 12, dosDate);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, contentBytes.length);
    writeUint32(localView, 22, contentBytes.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, dosTime);
    writeUint16(centralView, 14, dosDate);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, contentBytes.length);
    writeUint32(centralView, 24, contentBytes.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + contentBytes.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  return concatBytes([...localParts, centralDirectory, end]);
}

function exportEpub(details: NoteDetails) {
  const book = getNotebookBook(details.notebook);
  const chapters = asArray((details.bookmarkData as AnyRecord)?.chapters);
  const highlights = asArray((details.bookmarkData as AnyRecord)?.updated);
  const reviews = asArray((details.reviewData as AnyRecord)?.reviews).map(extractMineReview);
  const { pairs, unmatchedReviews } = pairNotes(chapters, highlights, reviews);
  const title = getBookTitle(book);
  const author = getBookAuthor(book) || "微信读书";
  const identifier =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `weread-${Date.now()}`;
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const noteBlocks = [
    ...pairs.map((pair) => `
      <section class="note-pair">
        <p class="note-meta">${escapeHtml(compact([pair.chapterTitle, formatDateTime(pair.createTime), pair.range]))}</p>
        <blockquote class="highlight-mark">${escapeHtml(pair.highlight.markText || "")}</blockquote>
        ${pair.reviews
          .map(
            (review) => `
              <div class="thought-mark">
                <p class="note-meta">${escapeHtml(compact([review.chapterName || pair.chapterTitle, formatDateTime(review.createTime), getNoteRange(review)]))}</p>
                <p>${escapeHtml(getReviewText(review))}</p>
              </div>
            `
          )
          .join("")}
      </section>
    `),
    ...unmatchedReviews.map(
      (review) => `
        <section class="note-pair standalone-thought">
          <div class="thought-mark">
            <p class="note-meta">${escapeHtml(compact([review.chapterName || "整本书", formatDateTime(review.createTime), getNoteRange(review)]))}</p>
            <p>${escapeHtml(getReviewText(review))}</p>
          </div>
        </section>
      `
    )
  ].join("");

  const notesXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
  <title>${escapeHtml(title)} - 笔记</title>
  <style>
    body { font-family: serif; line-height: 1.8; color: #14243a; }
    h1 { font-size: 1.8em; }
    .meta, .note-meta { color: #5e728a; font-size: 0.9em; }
    .note-pair { margin: 1em 0; padding: 1em; border: 1px solid #cfe0ee; }
    .highlight-mark { margin: 0.6em 0; padding: 0.8em 1em; border-left: 4px solid #9b8ad8; background: #f4efff; font-family: SimSun, serif; font-weight: bold; }
    .thought-mark { margin-top: 0.7em; padding: 0.75em 1em; border-left: 4px solid #79b58a; background: #eefaf0; font-family: KaiTi, serif; font-size: 0.95em; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">作者：${escapeHtml(author)} · 导出时间：${escapeHtml(exportedAt)}</p>
  <p class="meta">${highlights.length} 条划线 · ${reviews.length} 条想法/点评 · ${Number(details.notebook.bookmarkCount || 0)} 个书签</p>
  <h2>划线与想法</h2>
  ${noteBlocks || `<p>这本书没有可展示的划线、想法或点评。</p>`}
</body>
</html>`;

  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeHtml(identifier)}</dc:identifier>
    <dc:title>${escapeHtml(title)} - 笔记</dc:title>
    <dc:creator>${escapeHtml(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="notes"/>
  </spine>
</package>`;

  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head><title>${escapeHtml(title)} - 目录</title></head>
<body>
  <nav epub:type="toc">
    <h1>目录</h1>
    <ol><li><a href="notes.xhtml">划线与想法</a></li></ol>
  </nav>
</body>
</html>`;

  const containerXml = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  return new Blob(
    [
      createZip([
        { path: "mimetype", content: "application/epub+zip" },
        { path: "META-INF/container.xml", content: containerXml },
        { path: "OEBPS/content.opf", content: contentOpf },
        { path: "OEBPS/nav.xhtml", content: navXhtml },
        { path: "OEBPS/notes.xhtml", content: notesXhtml }
      ])
    ],
    { type: "application/epub+zip" }
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [proxyUrl, setProxyUrl] = useState(DEFAULT_WEREAD_PROXY_URL);
  const [activeTool, setActiveTool] = useState<ToolId>("shelf");
  const [keyword, setKeyword] = useState("");
  const [scope, setScope] = useState("10");
  const [bookId, setBookId] = useState("");
  const [bookQuery, setBookQuery] = useState("");
  const [resolvedBook, setResolvedBook] = useState<AnyRecord | null>(null);
  const [mode, setMode] = useState("monthly");
  const [reviewType, setReviewType] = useState("0");
  const [count, setCount] = useState("20");
  const [lastSort, setLastSort] = useState("");
  const [maxIdx, setMaxIdx] = useState("");
  const [synckey, setSynckey] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "bad">("idle");
  const [statusText, setStatusText] = useState("请先输入 API Key，然后测试连接。");
  const [error, setError] = useState("");
  const [connectionDebug, setConnectionDebug] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [noteDetails, setNoteDetails] = useState<NoteDetails | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinData, setCheckinData] = useState<DailyCheckinResult | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinError, setCheckinError] = useState("");

  const active = useMemo(() => tools.find((tool) => tool.id === activeTool) ?? tools[0], [activeTool]);

  useEffect(() => {
    const storedProxy = HAS_BUILT_IN_WEREAD_PROXY
      ? DEFAULT_WEREAD_PROXY_URL
      : window.localStorage.getItem(PROXY_URL_STORAGE) || DEFAULT_WEREAD_PROXY_URL;
    setProxyUrl(storedProxy);
    const stored = window.localStorage.getItem(API_KEY_STORAGE);
    if (stored) {
      setApiKey(stored);
      if (storedProxy.trim()) {
        setStatusText("已从本机浏览器读取 API Key，可直接测试连接。");
        void autoLoadShelf(stored, storedProxy);
        const today = localDateKey();
        if (window.localStorage.getItem(CHECKIN_LAST_POPUP_STORAGE) !== today) {
          void openDailyCheckin(stored, true, storedProxy);
        }
      } else {
        setStatusText("请先填写微信读书代理地址。");
      }
    }
  }, []);

  function saveProxyUrl(nextUrl = proxyUrl) {
    const trimmed = nextUrl.trim();
    setProxyUrl(trimmed);
    if (trimmed) {
      window.localStorage.setItem(PROXY_URL_STORAGE, trimmed);
      setStatusText("代理地址已保存到本机浏览器。");
    } else {
      window.localStorage.removeItem(PROXY_URL_STORAGE);
      setStatusText("请先填写微信读书代理地址。");
    }
    setStatus("idle");
    return trimmed;
  }

  function saveApiKey(nextKey = apiKey) {
    const trimmed = nextKey.trim();
    setApiKey(trimmed);
    if (trimmed) {
      window.localStorage.setItem(API_KEY_STORAGE, trimmed);
      setStatusText("API Key 已保存到本机浏览器。");
    } else {
      window.localStorage.removeItem(API_KEY_STORAGE);
      setStatusText("API Key 已清空。");
    }
    setStatus("idle");
    return trimmed;
  }

  async function callWeread(params: AnyRecord, keyOverride = apiKey, proxyOverride = proxyUrl) {
    const trimmedKey = keyOverride.trim();
    if (!trimmedKey) {
      throw new Error("请先输入 API Key。");
    }

    const endpoint = proxyOverride.trim();
    if (!endpoint) {
      throw new Error("请先填写微信读书代理地址。");
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ apiKey: trimmedKey, ...params })
      });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(`代理服务连接失败：${endpoint}。${err.message || "浏览器无法完成跨域请求。"}`);
      }
      throw err;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = (isRecord(data) && (data.message || data.errmsg)) || `请求失败：HTTP ${response.status}`;
      throw new Error(String(message));
    }

    if (isRecord(data) && typeof data.errcode === "number" && data.errcode !== 0) {
      throw new Error(String(data.errmsg || data.message || `微信读书返回错误 ${data.errcode}`));
    }

    return data;
  }

  function getConnectionErrorText(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("代理") || message.includes("Failed to fetch") || message.includes("fetch")) {
      return message;
    }
    return "连接失败。请检查 API Key 是否正确。";
  }

  async function checkProxyEndpoint(endpoint: string) {
    const trimmed = endpoint.trim();
    if (!trimmed) {
      throw new Error("请先填写微信读书代理地址。");
    }

    let response: Response;
    try {
      response = await fetch(trimmed, {
        method: "GET",
        cache: "no-store"
      });
    } catch {
      throw new Error("代理服务连接失败，请检查代理地址或代理服务是否可用。");
    }

    if (!response.ok) {
      throw new Error(`代理服务自检失败：HTTP ${response.status}`);
    }
  }

  async function resolveUsableProxy(preferredProxy = proxyUrl) {
    const candidates = HAS_BUILT_IN_WEREAD_PROXY
      ? BUILT_IN_WEREAD_PROXY_URLS
      : [preferredProxy.trim()].filter(Boolean);

    if (!candidates.length) {
      throw new Error("请先填写微信读书代理地址。");
    }

    const candidate = candidates[0].trim();
    setProxyUrl(candidate);
    if (!HAS_BUILT_IN_WEREAD_PROXY) {
      window.localStorage.setItem(PROXY_URL_STORAGE, candidate);
    }
    return candidate;

    let lastError = "";
    for (const candidate of candidates) {
      try {
        await checkProxyEndpoint(candidate);
        setProxyUrl(candidate);
        if (!HAS_BUILT_IN_WEREAD_PROXY) {
          window.localStorage.setItem(PROXY_URL_STORAGE, candidate);
        }
        return candidate;
      } catch {
        lastError = "Proxy health check failed.";
      }
    }

    throw new Error(lastError || "代理服务连接失败，请检查代理地址或代理服务是否可用。");
  }

  async function testConnection() {
    setLoading(true);
    setError("");
    setConnectionDebug("");
    setResult(null);
    let debugProxy = "";
    try {
      const savedKey = saveApiKey();
      const savedProxy = HAS_BUILT_IN_WEREAD_PROXY ? DEFAULT_WEREAD_PROXY_URL : saveProxyUrl();
      debugProxy = savedProxy;
      setStatus("idle");
      const usableProxy = await resolveUsableProxy(savedProxy);
      debugProxy = usableProxy;
      setConnectionDebug(`当前代理：${usableProxy}\n请求格式：POST text/plain\n测试接口：/shelf/sync`);
      setStatusText("正在通过内置代理测试 API Key...");
      const data = await callWeread({ api_name: "/shelf/sync" }, savedKey, usableProxy);
      setResult(data);
      setStatus("ok");
      setStatusText("连接成功。浏览器已通过代理访问微信读书 Skills。");
      setActiveTool("shelf");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("bad");
      setStatusText(getConnectionErrorText(err));
      setConnectionDebug(
        `当前代理：${debugProxy || DEFAULT_WEREAD_PROXY_URL || proxyUrl || "未设置"}\n错误：${message}\n如果手机能直接打开代理根地址，但这里失败，请确认 Deno 里的 main.js 已更新并重新 Deploy。`
      );
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function autoLoadShelf(nextKey = apiKey, proxyOverride = proxyUrl) {
    const trimmedKey = nextKey.trim();
    if (!trimmedKey) return;
    setActiveTool("shelf");
    setLoading(true);
    setError("");
    setNoteDetails(null);
    setNoteError("");
    try {
      const usableProxy = HAS_BUILT_IN_WEREAD_PROXY ? await resolveUsableProxy(proxyOverride) : proxyOverride;
      const data = await callWeread({ api_name: "/shelf/sync" }, trimmedKey, usableProxy);
      setResult(data);
      setStatus("ok");
      setStatusText("已自动加载我的书架。");
    } catch (err) {
      setStatus("bad");
      setStatusText(getConnectionErrorText(err));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function resolveBookIdFromQuery() {
    const input = bookQuery.trim() || bookId.trim();
    if (!input) {
      throw new Error("请输入书名、作者或 bookId。");
    }

    if (isLikelyBookId(input)) {
      setBookId(input);
      setResolvedBook(null);
      return input;
    }

    const searchData = await callWeread({
      api_name: "/store/search",
      keyword: input,
      scope: 0,
      count: 8
    });
    const shelfData = await callWeread({ api_name: "/shelf/sync" });
    const match = mergeBookMatches(extractShelfBookMatches(shelfData, input), extractSearchBookMatches(searchData))[0];
    if (!match) {
      throw new Error(`没有搜到“${input}”。可以换一个更完整的书名或作者再试。`);
    }

    setBookId(match.bookId);
    setBookQuery(match.title);
    setResolvedBook(match.book);
    return match.bookId;
  }

  async function runBookLookup() {
    const input = bookQuery.trim() || bookId.trim();
    if (!input) {
      throw new Error("请输入书名、作者或 bookId。");
    }

    if (isLikelyBookId(input)) {
      const detailData = await callWeread({ api_name: "/book/info", bookId: input });
      setBookId(input);
      setResolvedBook(isRecord(detailData) ? detailData : null);
      if (isRecord(detailData)) setBookQuery(getBookTitle(detailData));
      return {
        __kind: "bookLookup" as const,
        query: input,
        selectedBookId: input,
        searchData: null,
        detailData
      };
    }

    const searchData = await callWeread({
      api_name: "/store/search",
      keyword: input,
      scope: 0,
      count: Number(count) > 0 ? Number(count) : 20,
      ...(maxIdx.trim() ? { maxIdx: Number(maxIdx) } : {})
    });
    const shelfData = await callWeread({ api_name: "/shelf/sync" });
    const matches = mergeBookMatches(extractShelfBookMatches(shelfData, input), extractSearchBookMatches(searchData));
    const match = matches[0];
    if (!match) {
      throw new Error(`没有搜到“${input}”。可以换一个更完整的书名或作者再试。`);
    }

    const rawDetailData = await callWeread({ api_name: "/book/info", bookId: match.bookId });
    const detailData = mergeBookDetailWithFallback(rawDetailData, match.book);
    setBookId(match.bookId);
    setBookQuery(match.title);
    setResolvedBook(detailData);

    return {
      __kind: "bookLookup" as const,
      query: input,
      selectedBookId: match.bookId,
      searchData,
      shelfData,
      detailData
    };
  }

  async function runProgressLookup() {
    const input = bookQuery.trim() || bookId.trim();
    if (!input) {
      throw new Error("请输入书名、作者或 bookId。");
    }

    if (isLikelyBookId(input)) {
      const progressData = await callWeread({ api_name: "/book/getprogress", bookId: input });
      setBookId(input);
      setResolvedBook(null);
      return {
        __kind: "progressLookup" as const,
        query: input,
        selectedBookId: input,
        selectedBook: null,
        searchData: null,
        progressData
      };
    }

    const searchData = await callWeread({
      api_name: "/store/search",
      keyword: input,
      scope: 0,
      count: Math.max(Number(count) || 20, 20),
      ...(maxIdx.trim() ? { maxIdx: Number(maxIdx) } : {})
    });
    const shelfData = await callWeread({ api_name: "/shelf/sync" });
    const matches = mergeBookMatches(extractShelfBookMatches(shelfData, input), extractSearchBookMatches(searchData));
    const match = matches[0];
    if (!match) {
      throw new Error(`没有搜到“${input}”。可以换一个更完整的书名或作者再试。`);
    }

    const progressData = await callWeread({ api_name: "/book/getprogress", bookId: match.bookId });
    setBookId(match.bookId);
    setBookQuery(match.title);
    setResolvedBook(match.book);

    return {
      __kind: "progressLookup" as const,
      query: input,
      selectedBookId: match.bookId,
      selectedBook: match.book,
      searchData,
      shelfData,
      progressData
    };
  }

  async function buildToolParams() {
    const safeCount = Number(count) > 0 ? Number(count) : 20;

    if (activeTool === "search") {
      return {
        api_name: "/readdata/detail",
        mode
      };
    }

    if (activeTool === "shelf") return { api_name: "/shelf/sync" };

    if (activeTool === "notes") {
      return {
        api_name: "/user/notebooks",
        count: bookQuery.trim() ? Math.max(safeCount, 100) : safeCount,
        ...(lastSort.trim() ? { lastSort: Number(lastSort) } : {})
      };
    }

    if (activeTool === "afterword") return { api_name: "local" };

    const targetBookId = ["book", "progress", "chapters", "reviews"].includes(activeTool)
      ? await resolveBookIdFromQuery()
      : "";

    if (activeTool === "book") return { api_name: "/book/info", bookId: targetBookId };
    if (activeTool === "progress") return { api_name: "/book/getprogress", bookId: targetBookId };
    if (activeTool === "chapters") return { api_name: "/book/chapterinfo", bookId: targetBookId };

    if (activeTool === "reviews") {
      return {
        api_name: "/review/list",
        bookId: targetBookId,
        reviewListType: Number(reviewType),
        count: safeCount,
        ...(maxIdx.trim() ? { maxIdx: Number(maxIdx) } : {}),
        ...(synckey.trim() ? { synckey: Number(synckey) } : {})
      };
    }

    return {
      api_name: "/book/recommend",
      count: safeCount,
      ...(maxIdx.trim() ? { maxIdx: Number(maxIdx) } : {}),
      ...(sessionId.trim() ? { sessionId: sessionId.trim() } : {})
    };
  }

  async function runSmartDiscover(safeCount: number): Promise<SmartDiscoverResult> {
    const [statsResult, shelfResult, recommendResult] = await Promise.allSettled([
      callWeread({ api_name: "/readdata/detail", mode: "overall" }),
      callWeread({ api_name: "/shelf/sync" }),
      callWeread({
        api_name: "/book/recommend",
        count: Math.max(safeCount, 12),
        ...(maxIdx.trim() ? { maxIdx: Number(maxIdx) } : {})
      })
    ]);

    const statsData = statsResult.status === "fulfilled" ? statsResult.value : null;
    const shelfData = shelfResult.status === "fulfilled" ? shelfResult.value : null;
    const recommendData = recommendResult.status === "fulfilled" ? recommendResult.value : null;

    if (!recommendData && !statsData && !shelfData) {
      const firstError = [statsResult, shelfResult, recommendResult].find((result) => result.status === "rejected");
      throw new Error(firstError && firstError.status === "rejected" ? String(firstError.reason) : "暂时无法生成推荐。");
    }

    const shelfItems = normalizeShelfItems(isRecord(shelfData) ? shelfData : {});
    const existingBookIds = new Set(shelfItems.filter((item) => item.type === "book" && item.id).map((item) => item.id));
    const categories = getPreferenceCategoryNames(statsData);
    const seeds = getReadLongestSeeds(statsData);
    const categoryFallbacks = categories.length
      ? categories
      : Array.from(new Set(shelfItems.map((item) => item.category).filter(Boolean))).slice(0, 3);

    const similarResults = await Promise.allSettled(
      seeds.slice(0, 2).map((seed) =>
        callWeread({
          api_name: "/book/similar",
          bookId: seed.bookId,
          count: Math.max(6, Math.ceil(safeCount / 2))
        })
      )
    );

    const searchResults = await Promise.allSettled(
      categoryFallbacks.slice(0, 3).map((category) =>
        callWeread({
          api_name: "/store/search",
          keyword: category,
          scope: 10,
          count: 6
        })
      )
    );

    const similarData = similarResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const searchData = searchResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const recommendationGroups = [
      similarData.flatMap((data) => extractDiscoverBooks(data, "相似书推荐")),
      searchData.flatMap((data, index) =>
        extractDiscoverBooks(data, `偏好分类：${categoryFallbacks[index] || "相关分类"}`)
      ),
      extractDiscoverBooks(recommendData, "微信读书个性化推荐")
    ];
    const merged = mergeDiscoverBooks(recommendationGroups, existingBookIds, safeCount);

    return {
      __kind: "smartDiscover",
      books: merged.books,
      basis: {
        categories: categoryFallbacks,
        seedBooks: seeds.map((seed) => seed.title).filter(Boolean),
        shelfBookCount: existingBookIds.size,
        hiddenShelfMatches: merged.hiddenShelfMatches,
        sources: [
          recommendData ? "微信读书个性化推荐" : "",
          similarData.length ? "读得最多的书的相似推荐" : "",
          searchData.length ? "偏好分类相关搜索" : ""
        ].filter(Boolean)
      },
      raw: {
        statsData,
        shelfData,
        recommendData,
        similarData,
        searchData
      }
    };
  }

  async function runReadingUniverse(): Promise<ReadingUniverseResult> {
    const [shelfData, notebooksData] = await Promise.all([
      callWeread({ api_name: "/shelf/sync" }),
      callWeread({ api_name: "/user/notebooks", count: 100 })
    ]);
    const notebookMap = getNotebookMap(notebooksData);
    const shelfBooks = normalizeShelfItems(isRecord(shelfData) ? shelfData : {}).filter((item) => item.type === "book" && item.id);
    const progressLimit = Math.min(UNIVERSE_PROGRESS_LIMIT, Math.max(30, Number(count) || 40));
    const progressCandidates = [...shelfBooks]
      .sort((a, b) => {
        const noteA = getNotebookTotal(notebookMap.get(a.id) || {});
        const noteB = getNotebookTotal(notebookMap.get(b.id) || {});
        const ageA = daysSince(a.updatedAt);
        const ageB = daysSince(b.updatedAt);
        const scoreA = (a.finished ? 0 : 12) + Math.min(noteA, 30) + Math.min(ageA, 120) / 4;
        const scoreB = (b.finished ? 0 : 12) + Math.min(noteB, 30) + Math.min(ageB, 120) / 4;
        return scoreB - scoreA;
      })
      .slice(0, progressLimit);

    const progressResults = await Promise.allSettled(
      progressCandidates.map((book) => callWeread({ api_name: "/book/getprogress", bookId: book.id }))
    );

    return {
      __kind: "readingUniverse",
      shelfData,
      notebooksData,
      progressItems: progressResults
        .map((result, index) =>
          result.status === "fulfilled" ? { bookId: progressCandidates[index].id, data: result.value } : null
        )
        .filter(Boolean) as ReadingUniverseProgress[],
      progressLimit,
      generatedAt: Math.floor(Date.now() / 1000)
    };
  }

  async function loadDailyCheckin(nextKey = apiKey, proxyOverride = proxyUrl): Promise<DailyCheckinResult> {
    const trimmedKey = nextKey.trim();
    if (!trimmedKey) throw new Error("请先输入 API Key。");

    const dateKey = localDateKey();
    const [statsData, shelfData] = await Promise.all([
      callWeread({ api_name: "/readdata/detail", mode: "weekly" }, trimmedKey, proxyOverride),
      callWeread({ api_name: "/shelf/sync" }, trimmedKey, proxyOverride)
    ]);
    const readSeconds = getTodayReadSeconds(statsData, dateKey);
    const books = normalizeShelfItems(isRecord(shelfData) ? shelfData : {})
      .filter((item) => item.type === "book" && item.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const noteBooks = books.slice(0, 5);
    const noteResults = await Promise.allSettled(
      noteBooks.map(async (book) => {
        const [bookmarkData, reviewData] = await Promise.all([
          callWeread({ api_name: "/book/bookmarklist", bookId: book.id }, trimmedKey, proxyOverride),
          callWeread({ api_name: "/review/list/mine", bookid: book.id, count: 50 }, trimmedKey, proxyOverride)
        ]);
        const allHighlights = asArray((isRecord(bookmarkData) ? bookmarkData : {}).updated);
        const allReviews = asArray((isRecord(reviewData) ? reviewData : {}).reviews).map(extractMineReview);
        return {
          book,
          highlights: allHighlights.filter((item) => isTodayTimestamp(item.createTime || item.updateTime, dateKey)),
          reviews: allReviews.filter((item) => isTodayTimestamp(item.createTime || item.updateTime, dateKey)),
          fallbackHighlight: allHighlights[0] || null
        };
      })
    );
    const items = noteResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((item) => item.highlights.length || item.reviews.length)
      .map(({ book, highlights, reviews }) => ({ book, highlights, reviews }));
    const fallbackQuote =
      noteResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value.fallbackHighlight)
        .find(Boolean) || null;
    const forgotten = books
      .filter((book) => !book.finished && book.updatedAt > 0 && daysSince(book.updatedAt) >= 14)
      .sort((a, b) => daysSince(b.updatedAt) - daysSince(a.updatedAt));
    const recommendedBooks = mergeShelfRecommendations(readSeconds > 0 ? books : [...forgotten, ...books]).slice(0, 2);

    return {
      __kind: "dailyCheckin",
      dateKey,
      dateLabel: localDateLabel(),
      readSeconds,
      items,
      fallbackQuote,
      recommendedBooks,
      streakDays: getCheckinStreak(dateKey),
      generatedAt: Math.floor(Date.now() / 1000)
    };
  }

  async function openDailyCheckin(nextKey = apiKey, auto = false, proxyOverride = proxyUrl) {
    const trimmedKey = nextKey.trim();
    if (!trimmedKey) {
      if (!auto) setCheckinError("请先输入 API Key。");
      return;
    }
    setCheckinOpen(true);
    setCheckinLoading(true);
    setCheckinError("");
    try {
      const data = await loadDailyCheckin(trimmedKey, proxyOverride);
      setCheckinData(data);
      if (auto) window.localStorage.setItem(CHECKIN_LAST_POPUP_STORAGE, data.dateKey);
    } catch (err) {
      setCheckinError(err instanceof Error ? err.message : String(err));
      if (auto) setCheckinOpen(false);
    } finally {
      setCheckinLoading(false);
    }
  }

  async function runTool(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    if (activeTool === "notes") {
      setNoteDetails(null);
      setNoteError("");
    }

    try {
      if (activeTool === "afterword") {
        setResult({ __kind: "afterword" });
        return;
      }
      saveApiKey();
      if (activeTool === "book") {
        const data = await runBookLookup();
        setResult(data);
        return;
      }
      if (activeTool === "progress") {
        const data = await runProgressLookup();
        setResult(data);
        return;
      }
      if (activeTool === "discover") {
        const safeCount = Number(count) > 0 ? Number(count) : 20;
        const data = await runSmartDiscover(safeCount);
        setResult(data);
        return;
      }
      if (activeTool === "universe") {
        const data = await runReadingUniverse();
        setResult(data);
        return;
      }
      if (activeTool === "checkin") {
        const data = await loadDailyCheckin();
        setCheckinData(data);
        setCheckinOpen(true);
        setResult(data);
        return;
      }
      const data = await callWeread(await buildToolParams());
      setResult(data);
      if (activeTool === "notes" && bookQuery.trim()) {
        const query = bookQuery.trim().toLowerCase();
        const notebooks = asArray((isRecord(data) ? data : {}).books) as NoteNotebook[];
        const match = notebooks.find((notebook) => {
          const book = getNotebookBook(notebook);
          return `${getBookTitle(book)} ${getBookAuthor(book)}`.toLowerCase().includes(query);
        });

        if (match) {
          await loadBookNotes(match);
        } else {
          setNoteError("没有在笔记本里找到这个书名。可以清空书名后查看全部笔记本。");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadBookNotes(notebook: NoteNotebook) {
    const selectedBookId = getNotebookBookId(notebook);
    if (!selectedBookId) {
      setNoteError("这本书缺少 bookId，无法读取笔记详情。");
      return;
    }

    setNoteLoading(true);
    setNoteError("");
    setNoteDetails(null);
    try {
      const [bookmarkData, reviewData] = await Promise.all([
        callWeread({ api_name: "/book/bookmarklist", bookId: selectedBookId }),
        callWeread({ api_name: "/review/list/mine", bookid: selectedBookId, count: 100 })
      ]);
      setNoteDetails({ notebook, bookmarkData, reviewData });
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : String(err));
    } finally {
      setNoteLoading(false);
    }
  }

  async function openProgressMatch(match: SearchBookMatch) {
    if (!match.bookId) return;
    const currentLookup = isProgressLookupResult(result) ? result : null;
    setActiveTool("progress");
    setBookId(match.bookId);
    setBookQuery(match.title);
    setResolvedBook(match.book);
    setLoading(true);
    setError("");
    setNoteDetails(null);
    setNoteError("");
    try {
      const progressData = await callWeread({ api_name: "/book/getprogress", bookId: match.bookId });
      setResult({
        __kind: "progressLookup" as const,
        query: currentLookup?.query || match.title,
        selectedBookId: match.bookId,
        selectedBook: match.book,
        searchData: currentLookup?.searchData ?? null,
        shelfData: currentLookup?.shelfData,
        progressData
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function openBookDetail(nextBookId: string, fallbackBook?: AnyRecord) {
    const trimmed = nextBookId.trim();
    if (!trimmed) return;
    setActiveTool("book");
    setBookId(trimmed);
    setLoading(true);
    setError("");
    setResult(null);
    setResolvedBook(null);
    setNoteDetails(null);
    setNoteError("");
    try {
      const rawData = await callWeread({ api_name: "/book/info", bookId: trimmed });
      const data = mergeBookDetailWithFallback(rawData, fallbackBook);
      setResult(data);
      setResolvedBook(data);
      setBookQuery(getBookTitle(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function openBookChapters(nextBookId: string) {
    const trimmed = nextBookId.trim();
    if (!trimmed) return;
    setActiveTool("chapters");
    setBookId(trimmed);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await callWeread({ api_name: "/book/chapterinfo", bookId: trimmed });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function openBookNotesFromBook(book: AnyRecord) {
    const targetBookId = String(book.bookId || book.id || "").trim();
    if (!targetBookId) return;
    const notebook: NoteNotebook = {
      bookId: targetBookId,
      book,
      noteCount: 0,
      reviewCount: 0,
      bookmarkCount: 0
    };
    setBookId(targetBookId);
    setBookQuery(getBookTitle(book));
    setResolvedBook(book);
    setActiveTool("notes");
    setResult({ books: [notebook], totalBookCount: 1, totalNoteCount: 0, hasMore: 0 });
    await loadBookNotes(notebook);
  }

  function downloadMarkdown() {
    if (!noteDetails) return;
    const markdown = exportMarkdown(noteDetails);
    const book = getNotebookBook(noteDetails.notebook);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${getBookTitle(book)}-笔记.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadEpub() {
    if (!noteDetails) return;
    const book = getNotebookBook(noteDetails.notebook);
    const blob = exportEpub(noteDetails);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(getBookTitle(book))}-笔记.epub`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="hero no-print">
          <div className="title-panel">
            <div className="title-row">
              <div className="brand-mark">
                <Sparkles size={24} />
              </div>
              <div>
                <h1>WeRead Skills Web</h1>
                <p className="subtitle">微信读书 Skills 的轻量网页客户端。</p>
              </div>
            </div>
            <div className="facts">
              <span className="pill">Next.js Web</span>
              <span className="pill">/api/weread Skill Proxy</span>
              <span className="pill">API Key 仅存在浏览器</span>
              <span className="pill">无数据库</span>
            </div>
            <div className="hero-quote">
              <p>我们读过许多书，</p>
              <p>却总在寻找曾经打动自己的那一句。</p>
              <p>于是，把阅读重新收藏起来。</p>
            </div>
          </div>

          <div className="connect-panel">
            <h2>连接微信读书</h2>
            {!HAS_BUILT_IN_WEREAD_PROXY ? (
              <div className="field">
                <label htmlFor="proxyUrl">代理地址</label>
                <input
                  id="proxyUrl"
                  type="url"
                  value={proxyUrl}
                  onChange={(event) => setProxyUrl(event.target.value)}
                  onBlur={() => saveProxyUrl()}
                  placeholder="https://你的代理地址"
                />
                <p className="field-help">Cloudflare 在国内可能不可用；请填写当前可访问的微信读书代理地址。</p>
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="apiKey">API Key</label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                onBlur={() => {
                  const savedKey = saveApiKey();
                  const savedProxy = saveProxyUrl();
                  if (savedKey && savedProxy && !result) void autoLoadShelf(savedKey, savedProxy);
                  if (savedKey && savedProxy && window.localStorage.getItem(CHECKIN_LAST_POPUP_STORAGE) !== localDateKey()) {
                    void openDailyCheckin(savedKey, true, savedProxy);
                  }
                }}
                placeholder="wrk-xxxxxxxx"
              />
            </div>
            <div className="actions">
              <button className="button primary" onClick={testConnection} disabled={loading}>
                {loading ? <Loader2 size={17} /> : <CheckCircle2 size={17} />}
                测试连接
              </button>
              <button
                className="button ghost"
                onClick={() => {
                  setApiKey("");
                  saveApiKey("");
                  setResult(null);
                  setError("");
                  setStatus("idle");
                  setActiveTool("shelf");
                }}
                disabled={loading}
              >
                清空
              </button>
            </div>
            <div className={`status ${status === "ok" ? "ok" : status === "bad" ? "bad" : ""}`}>
              {status === "ok" ? <CheckCircle2 size={17} /> : <Settings size={17} />}
              {statusText}
            </div>
            {connectionDebug ? (
              <details className="connection-debug">
                <summary>连接诊断</summary>
                <pre>{connectionDebug}</pre>
              </details>
            ) : null}
          </div>
        </section>

        <section className="main">
          <nav className="tabs no-print" aria-label="功能标签">
            {tools.map((tool) => (
              <button
                className={`tab ${activeTool === tool.id ? "active" : ""}`}
                key={tool.id}
                onClick={() => {
                  setActiveTool(tool.id);
                  setError("");
                  setResult(tool.id === "afterword" ? { __kind: "afterword" } : null);
                  setNoteDetails(null);
                  setNoteError("");
                }}
              >
                {tool.icon}
                {tool.label}
              </button>
            ))}
          </nav>

          <div className="workspace">
            <form className="tool-panel no-print" onSubmit={runTool}>
              <h2>{active.label}</h2>
              <p className="hint">
                调用 <strong>{active.apiName}</strong>。所有请求都会先进入本站代理，再转发到微信读书网关。
              </p>
              <ToolFields
                activeTool={activeTool}
                keyword={keyword}
                setKeyword={setKeyword}
                scope={scope}
                setScope={setScope}
                bookId={bookId}
                setBookId={setBookId}
                bookQuery={bookQuery}
                setBookQuery={setBookQuery}
                resolvedBook={resolvedBook}
                setResolvedBook={setResolvedBook}
                mode={mode}
                setMode={setMode}
                reviewType={reviewType}
                setReviewType={setReviewType}
                count={count}
                setCount={setCount}
                lastSort={lastSort}
                setLastSort={setLastSort}
                maxIdx={maxIdx}
                setMaxIdx={setMaxIdx}
                synckey={synckey}
                setSynckey={setSynckey}
                sessionId={sessionId}
                setSessionId={setSessionId}
              />
              <div className="actions">
                <button className="button primary" disabled={loading} type="submit">
                  {loading ? <Loader2 size={17} /> : active.icon}
                  查询
                </button>
              </div>
            </form>

            <section className="result-panel">
              <h2 className="no-print">结果</h2>
              {loading ? <div className="message no-print">正在请求微信读书 Skills...</div> : null}
              {error ? <div className="message error no-print">{error}</div> : null}
              {!loading && !error && !result ? (
                <div className="message no-print">还没有结果。选择功能并点击查询。</div>
              ) : null}
              {isRecord(result) && isRecord(result.upgrade_info) ? (
                <div className="message warn no-print">
                  检测到 skill 需要升级：{String(result.upgrade_info.message || "请按返回提示处理。")}
                </div>
              ) : null}
              {result ? (
                <ResultView
                  tool={activeTool}
                  data={result}
                  bookId={bookId}
                  onSelectNotebook={loadBookNotes}
                  noteDetails={noteDetails}
                  noteLoading={noteLoading}
                  noteError={noteError}
                  onPrint={() => window.print()}
                  onMarkdown={downloadMarkdown}
                  onEpub={downloadEpub}
                  onOpenBookDetail={openBookDetail}
                  onOpenBookChapters={openBookChapters}
                  onOpenBookNotes={openBookNotesFromBook}
                  onOpenProgress={openProgressMatch}
                  onOpenSupport={() => setSupportOpen(true)}
                  onOpenCheckin={() => void openDailyCheckin()}
                />
              ) : null}
            </section>
          </div>
        </section>
      </div>
      {supportOpen ? <SupportModal onClose={() => setSupportOpen(false)} /> : null}
      {checkinOpen ? (
        <DailyCheckinModal
          data={checkinData}
          loading={checkinLoading}
          error={checkinError}
          onClose={() => setCheckinOpen(false)}
          onReload={() => void openDailyCheckin()}
        />
      ) : null}
    </main>
  );
}

function ToolFields(props: {
  activeTool: ToolId;
  keyword: string;
  setKeyword: (value: string) => void;
  scope: string;
  setScope: (value: string) => void;
  bookId: string;
  setBookId: (value: string) => void;
  bookQuery: string;
  setBookQuery: (value: string) => void;
  resolvedBook: AnyRecord | null;
  setResolvedBook: (value: AnyRecord | null) => void;
  mode: string;
  setMode: (value: string) => void;
  reviewType: string;
  setReviewType: (value: string) => void;
  count: string;
  setCount: (value: string) => void;
  lastSort: string;
  setLastSort: (value: string) => void;
  maxIdx: string;
  setMaxIdx: (value: string) => void;
  synckey: string;
  setSynckey: (value: string) => void;
  sessionId: string;
  setSessionId: (value: string) => void;
}) {
  const {
    activeTool,
    keyword,
    setKeyword,
    scope,
    setScope,
    bookId,
    setBookId,
    bookQuery,
    setBookQuery,
    resolvedBook,
    setResolvedBook,
    mode,
    setMode,
    reviewType,
    setReviewType,
    count,
    setCount,
    lastSort,
    setLastSort,
    maxIdx,
    setMaxIdx,
    synckey,
    setSynckey,
    sessionId,
    setSessionId
  } = props;

  function updateBookQuery(value: string) {
    setBookQuery(value);
    setBookId("");
    setResolvedBook(null);
  }

  if (activeTool === "shelf") {
    return <p className="hint">这个接口无需额外参数。查询后会显示封面书架。</p>;
  }

  if (activeTool === "checkin") {
    return (
      <div className="message checkin-query-note">
        每日打卡会自动读取今日阅读时长、最近书籍和今天的划线/想法。无需额外参数，点击查询即可重新生成今日打卡数据。
      </div>
    );
  }

  if (activeTool === "universe") {
    return (
      <div className="grid">
        <Field label="进度补查数量">
          <input value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
          <p className="hint">默认最多补查 50 本书的阅读进度，用来识别半途停下和很久没读的书。</p>
        </Field>
        <div className="message">
          把散落在书架里的星光，连成你的阅读宇宙。会结合书架、笔记数量和阅读进度生成关系图。
        </div>
      </div>
    );
  }

  if (activeTool === "afterword") {
    return <p className="hint">这里是项目的跋：打赏支持、项目说明和版权声明，无需连接微信读书接口。</p>;
  }

  if (activeTool === "search") {
    return (
      <div className="grid">
        <Field label="分析周期">
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="hint">生成阅读热力图、书籍偏好、习惯追踪和复盘报告。</p>
        </Field>
      </div>
    );
  }

  if (activeTool === "notes") {
    return (
      <div className="notes-query-form">
        <Field label="书名或作者（可选）">
          <input
            value={bookQuery}
            onChange={(event) => updateBookQuery(event.target.value)}
            placeholder="例如：三体、莫言"
          />
        </Field>
        <Field label="数量">
          <input value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
        </Field>
        <p className="hint notes-query-hint">填写书名或作者后，会在笔记本里自动匹配并打开这本书的划线/想法；留空则查看全部笔记本。</p>
      </div>
    );
  }

  if (activeTool === "book") {
    return (
      <div className="grid">
        <Field label="书名或作者">
          <input
            value={bookQuery}
            onChange={(event) => updateBookQuery(event.target.value)}
            placeholder="例如：三体、活着；也可粘贴 bookId"
          />
          {resolvedBook ? (
            <p className="hint">
              将自动使用：{getBookTitle(resolvedBook)}
              {getBookAuthor(resolvedBook) ? ` · ${getBookAuthor(resolvedBook)}` : ""}
            </p>
          ) : (
            <p className="hint">查询后会在同一个页面显示候选书和当前书详情。</p>
          )}
        </Field>
        <Field label="候选数量">
          <input value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
        </Field>
      </div>
    );
  }

  if (activeTool === "reviews") {
    return (
      <div className="grid">
        <Field label="书名或作者">
          <input
            value={bookQuery}
            onChange={(event) => updateBookQuery(event.target.value)}
            placeholder="例如：三体、活着；也可粘贴 bookId"
          />
          {bookId ? <p className="hint">已匹配 bookId：{bookId}</p> : null}
        </Field>
        <Field label="点评类型">
          <select value={reviewType} onChange={(event) => setReviewType(event.target.value)}>
            {reviewTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="数量">
          <input value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
        </Field>
        <Field label="maxIdx（翻页可选）">
          <input value={maxIdx} onChange={(event) => setMaxIdx(event.target.value)} inputMode="numeric" />
        </Field>
        <Field label="synckey（翻页可选）">
          <input value={synckey} onChange={(event) => setSynckey(event.target.value)} inputMode="numeric" />
        </Field>
      </div>
    );
  }

  if (activeTool === "discover") {
    return (
      <div className="grid">
        <Field label="数量">
          <input value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
          <p className="hint">会自动结合阅读年轮、书架和读得最多的书生成推荐。</p>
        </Field>
        <Field label="maxIdx（翻页可选）">
          <input value={maxIdx} onChange={(event) => setMaxIdx(event.target.value)} inputMode="numeric" />
          <p className="hint">用于微信读书个性化推荐翻页；相似书推荐会自动处理。</p>
        </Field>
      </div>
    );
  }

  return (
    <div className="grid">
      <Field label="书名或作者">
        <input
          value={bookQuery}
          onChange={(event) => updateBookQuery(event.target.value)}
          placeholder="例如：三体、活着；也可粘贴 bookId"
        />
        {resolvedBook ? (
          <p className="hint">
            将自动使用：{getBookTitle(resolvedBook)}
            {getBookAuthor(resolvedBook) ? ` · ${getBookAuthor(resolvedBook)}` : ""}
          </p>
        ) : bookId ? (
          <p className="hint">已匹配 bookId：{bookId}</p>
        ) : (
          <p className="hint">查询时会先搜索书名，再自动调用当前功能。</p>
        )}
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function ResultView({
  tool,
  data,
  bookId,
  onSelectNotebook,
  noteDetails,
  noteLoading,
  noteError,
  onPrint,
  onMarkdown,
  onEpub,
  onOpenBookDetail,
  onOpenBookChapters,
  onOpenBookNotes,
  onOpenProgress,
  onOpenSupport,
  onOpenCheckin
}: {
  tool: ToolId;
  data: unknown;
  bookId: string;
  onSelectNotebook: (notebook: NoteNotebook) => void;
  noteDetails: NoteDetails | null;
  noteLoading: boolean;
  noteError: string;
  onPrint: () => void;
  onMarkdown: () => void;
  onEpub: () => void;
  onOpenBookDetail: (bookId: string, fallbackBook?: AnyRecord) => void;
  onOpenBookChapters: (bookId: string) => void;
  onOpenBookNotes: (book: AnyRecord) => void;
  onOpenProgress: (match: SearchBookMatch) => void;
  onOpenSupport: () => void;
  onOpenCheckin: () => void;
}) {
  return (
    <>
      {tool === "checkin" ? <DailyCheckinSummary data={data} onOpenCheckin={onOpenCheckin} /> : null}
      {tool === "search" ? <ReadingAnalysisSummary data={data} onPrint={onPrint} /> : null}
      {tool === "shelf" ? <ShelfSummary data={data} onOpenBookDetail={onOpenBookDetail} /> : null}
      {tool === "universe" ? (
        <ReadingUniverseSummary data={data} onOpenBookDetail={onOpenBookDetail} onOpenBookNotes={onOpenBookNotes} />
      ) : null}
      {tool === "notes" ? (
        <NotesSummary
          data={data}
          onSelectNotebook={onSelectNotebook}
          noteDetails={noteDetails}
          noteLoading={noteLoading}
          noteError={noteError}
          onPrint={onPrint}
          onMarkdown={onMarkdown}
          onEpub={onEpub}
        />
      ) : null}
      {tool === "book" ? (
        <BookLookupSummary
          data={data}
          onOpenBookDetail={onOpenBookDetail}
          onOpenBookChapters={onOpenBookChapters}
          onOpenBookNotes={onOpenBookNotes}
        />
      ) : null}
      {tool === "progress" ? <ProgressSummary data={data} onOpenProgress={onOpenProgress} /> : null}
      {tool === "chapters" ? <ChaptersSummary data={data} bookId={bookId} /> : null}
      {tool === "reviews" ? <ReviewsSummary data={data} /> : null}
      {tool === "discover" ? <DiscoverSummary data={data} onOpenBookDetail={onOpenBookDetail} /> : null}
      {tool === "afterword" ? <AfterwordSummary onOpenSupport={onOpenSupport} /> : null}
      {tool !== "afterword" ? (
      <details className="no-print">
        <summary>查看原始 JSON</summary>
        <pre className="json-box">{JSON.stringify(data, null, 2)}</pre>
      </details>
      ) : null}
    </>
  );
}

function readStoredIdSet(key: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return new Set(asStringArray(value));
  } catch {
    return new Set<string>();
  }
}

function writeStoredIdSet(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(ids)));
}

function ReadingUniverseSummary({
  data,
  onOpenBookDetail,
  onOpenBookNotes
}: {
  data: unknown;
  onOpenBookDetail: (bookId: string, fallbackBook?: AnyRecord) => void;
  onOpenBookNotes: (book: AnyRecord) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [graphMode, setGraphMode] = useState<"overview" | "focus">("overview");
  const [showLabels, setShowLabels] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => readStoredIdSet(UNIVERSE_REVIEWED_STORAGE));
  const [mutedIds, setMutedIds] = useState<Set<string>>(() => readStoredIdSet(UNIVERSE_MUTED_STORAGE));
  const result = isReadingUniverseResult(data) ? data : null;
  const allBooks = useMemo(
    () => (result ? buildUniverseBooks(result.shelfData, result.notebooksData, result.progressItems) : []),
    [result]
  );
  const allLinks = useMemo(() => buildUniverseLinks(allBooks), [allBooks]);
  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    allLinks.forEach((link) => {
      map.set(link.source, (map.get(link.source) || 0) + link.weight);
      map.set(link.target, (map.get(link.target) || 0) + link.weight);
    });
    return map;
  }, [allLinks]);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allBooks
      .filter((book) => {
        const noteTotal = book.noteCount + book.reviewCount + book.bookmarkCount;
        const progress = book.progress ?? (book.finished ? 100 : undefined);
        const matchesQuery =
          !normalizedQuery || `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(normalizedQuery);
        if (!matchesQuery) return false;
        if (filter === "recent") return daysSince(book.lastReadAt) <= 45;
        if (filter === "noted") return noteTotal > 0;
        if (filter === "unfinished") return progress !== undefined && progress >= 20 && progress <= 80;
        if (filter === "connected") return (degreeMap.get(book.id) || 0) >= 5;
        return true;
      })
      .sort((a, b) => {
        const scoreA = (degreeMap.get(a.id) || 0) + (a.noteCount + a.reviewCount) * 1.2 + (a.lastReadAt || 0) / 1000000000;
        const scoreB = (degreeMap.get(b.id) || 0) + (b.noteCount + b.reviewCount) * 1.2 + (b.lastReadAt || 0) / 1000000000;
        return scoreB - scoreA;
      })
      .slice(0, 36);
  }, [allBooks, degreeMap, filter, query]);

  const visibleIds = new Set(filteredBooks.map((book) => book.id));
  const visibleLinks = allLinks.filter((link) => visibleIds.has(link.source) && visibleIds.has(link.target)).slice(0, 70);
  const selected = filteredBooks.find((book) => book.id === selectedId) || filteredBooks[0];
  const selectedLinks = selected
    ? allLinks.filter((link) => link.source === selected.id || link.target === selected.id).slice(0, 18)
    : [];
  const selectedReasons = Array.from(new Set(selectedLinks.flatMap((link) => link.reasons))).slice(0, 6);
  const focusIds = new Set([selected?.id || "", ...selectedLinks.flatMap((link) => [link.source, link.target])].filter(Boolean));
  const graphBooks =
    graphMode === "focus" && selected
      ? allBooks.filter((book) => focusIds.has(book.id)).slice(0, 20)
      : filteredBooks;
  const graphIds = new Set(graphBooks.map((book) => book.id));
  const graphLinks =
    graphMode === "focus" && selected
      ? allLinks.filter((link) => graphIds.has(link.source) && graphIds.has(link.target) && (link.source === selected.id || link.target === selected.id))
      : visibleLinks;

  const forgottenBooks = allBooks
    .filter((book) => !reviewedIds.has(book.id) && !mutedIds.has(book.id))
    .map((book) => {
      const noteTotal = book.noteCount + book.reviewCount + book.bookmarkCount;
      const progress = book.progress ?? (book.finished ? 100 : undefined);
      const awayDays = daysSince(book.lastReadAt);
      const hasReadTime = book.lastReadAt > 0;
      const halfRead = hasReadTime && progress !== undefined && progress >= 20 && progress <= 80 && awayDays >= 14;
      const noteRich = hasReadTime && noteTotal >= 8 && awayDays >= 30;
      const notReviewed = hasReadTime && noteTotal > 0 && awayDays >= 7 && !book.finished;
      const score = (halfRead ? 40 : 0) + (noteRich ? 28 : 0) + (notReviewed ? 14 : 0) + Math.min(awayDays, 120) / 3 + noteTotal;
      return { book, noteTotal, progress, awayDays, score, visible: halfRead || noteRich || notReviewed };
    })
    .filter((item) => item.visible)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  function updateReviewed(bookId: string) {
    const next = new Set(reviewedIds);
    next.add(bookId);
    setReviewedIds(next);
    writeStoredIdSet(UNIVERSE_REVIEWED_STORAGE, next);
  }

  function updateMuted(bookId: string) {
    const next = new Set(mutedIds);
    next.add(bookId);
    setMutedIds(next);
    writeStoredIdSet(UNIVERSE_MUTED_STORAGE, next);
  }

  if (!result) return <div className="message">阅读宇宙数据格式不完整，请重新查询。</div>;
  if (!allBooks.length) return <div className="message">书架里暂时没有可用于生成阅读宇宙的电子书。</div>;

  return (
    <section className="universe">
      <div className="universe-hero">
        <div>
          <p className="eyebrow">阅读宇宙</p>
          <h2>把散落在书架里的星光，连成你的阅读宇宙。</h2>
          <p className="hint">
            已分析 {allBooks.length} 本书、{allLinks.length} 条关系；本次补查 {result.progressItems.length}/
            {result.progressLimit} 本阅读进度。
          </p>
        </div>
        <div className="universe-stats">
          <Metric label="书籍节点" value={allBooks.length} />
          <Metric label="关系连线" value={allLinks.length} />
          <Metric label="被遗忘提醒" value={forgottenBooks.length} />
        </div>
      </div>

      <div className="universe-controls no-print">
        <div className="shelf-search universe-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名、作者或分类" />
        </div>
        <div className="universe-filter">
          {[
            ["all", "全部"],
            ["recent", "最近阅读"],
            ["noted", "有笔记"],
            ["unfinished", "半途停下"],
            ["connected", "高关联"]
          ].map(([value, label]) => (
            <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)} type="button">
              {label}
            </button>
          ))}
        </div>
        <div className="universe-view-tools">
          <button className={graphMode === "overview" ? "active" : ""} onClick={() => setGraphMode("overview")} type="button">
            全图
          </button>
          <button className={graphMode === "focus" ? "active" : ""} onClick={() => setGraphMode("focus")} type="button">
            只看这本关系
          </button>
          <button className={showLabels ? "active" : ""} onClick={() => setShowLabels((value) => !value)} type="button">
            {showLabels ? "隐藏书名" : "显示书名"}
          </button>
        </div>
        <p className="hint universe-hint">
          当前显示 {graphBooks.length} 本、{graphLinks.length} 条关系。默认隐藏大部分书名，点击节点后右侧会显示具体关系原因。
        </p>
      </div>

      <div className="universe-layout">
        <UniverseGraph
          books={graphBooks}
          links={graphLinks}
          selectedId={selected?.id || ""}
          showLabels={showLabels}
          onSelect={setSelectedId}
        />
        <aside className="universe-detail">
          {selected ? (
            <>
              <div className="universe-book-head">
                <div className="universe-cover">
                  {selected.cover ? <img src={selected.cover} alt={selected.title} loading="lazy" /> : <span>书</span>}
                </div>
                <div>
                  <h3>{selected.title}</h3>
                  <p className="meta">{compact([selected.author, selected.category, `bookId ${selected.id}`])}</p>
                </div>
              </div>
              <div className="relation-tags">
                {(selectedReasons.length ? selectedReasons : ["等待更多关联"]).map((reason) => (
                  <span key={reason}>{reason}</span>
                ))}
              </div>
              <div className="cards compact-cards">
                <Metric label="阅读进度" value={selected.progress !== undefined ? `${selected.progress}%` : selected.finished ? "已读完" : "-"} />
                <Metric label="多久没见" value={selected.lastReadAt ? `${daysSince(selected.lastReadAt)}天` : "-"} />
                <Metric label="笔记/想法" value={selected.noteCount + selected.reviewCount} />
                <Metric label="关系强度" value={degreeMap.get(selected.id) || 0} />
              </div>
              <div className="actions">
                <WereadAppLink className="button primary" bookId={selected.id}>
                  继续阅读
                </WereadAppLink>
                <button className="button ghost" onClick={() => onOpenBookDetail(selected.id, selected.raw)} type="button">
                  查看详情
                </button>
                <button className="button ghost" onClick={() => onOpenBookNotes(selected.raw)} type="button">
                  查看笔记
                </button>
              </div>
              {selectedLinks.length ? (
                <div className="relation-list">
                  <h3>和它相连的书</h3>
                  {selectedLinks.map((link) => {
                    const otherId = link.source === selected.id ? link.target : link.source;
                    const other = allBooks.find((book) => book.id === otherId);
                    if (!other) return null;
                    return (
                      <button className="relation-row" key={`${link.source}-${link.target}`} onClick={() => setSelectedId(other.id)} type="button">
                        <span>{other.title}</span>
                        <small>{compact([other.author, link.reasons.join(" / ")])}</small>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : (
            <div className="message">选择一本书，查看它和其它书的关系。</div>
          )}
        </aside>
      </div>

      <section className="forgotten-section">
        <div>
          <h2>被遗忘的书</h2>
          <p className="hint">找出半途停下、笔记很多但很久没回看的书。提醒状态只保存在本地浏览器。</p>
        </div>
        {forgottenBooks.length ? (
          <div className="forgotten-grid">
            {forgottenBooks.map(({ book, noteTotal, progress, awayDays }) => (
              <article className="forgotten-card" key={book.id}>
                <div className="universe-cover">
                  {book.cover ? <img src={book.cover} alt={book.title} loading="lazy" /> : <span>书</span>}
                </div>
                <div>
                  <h3>你和《{book.title}》已经 {awayDays} 天没见了。</h3>
                  <p className="hint">
                    {compact([
                      book.author,
                      progress !== undefined ? `上次停在 ${progress}%` : "",
                      noteTotal ? `${noteTotal} 条笔记相关记录` : "",
                      formatDate(book.lastReadAt)
                    ])}
                  </p>
                  <div className="actions">
                    <WereadAppLink className="button primary" bookId={book.id}>
                      继续阅读
                    </WereadAppLink>
                    <button className="button ghost" onClick={() => onOpenBookNotes(book.raw)} type="button">
                      查看笔记
                    </button>
                    <button className="button ghost" onClick={() => updateReviewed(book.id)} type="button">
                      标记已复盘
                    </button>
                    <button className="button ghost" onClick={() => updateMuted(book.id)} type="button">
                      暂时不提醒
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="message">暂时没有明显被遗忘的书。挺好，说明你的书架还在呼吸。</div>
        )}
      </section>
    </section>
  );
}

function UniverseGraph({
  books,
  links,
  selectedId,
  showLabels,
  onSelect
}: {
  books: UniverseBook[];
  links: UniverseLink[];
  selectedId: string;
  showLabels: boolean;
  onSelect: (bookId: string) => void;
}) {
  const width = 1320;
  const height = 880;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.42;
  const connectedToSelected = new Set(
    links
      .filter((link) => selectedId && (link.source === selectedId || link.target === selectedId))
      .flatMap((link) => [link.source, link.target])
  );
  const positions = new Map(
    books.map((book, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(books.length, 1) - Math.PI / 2;
      const ring = 0.48 + ((index % 5) * 0.13);
      return [
        book.id,
        {
          x: centerX + Math.cos(angle) * radius * ring,
          y: centerY + Math.sin(angle) * radius * ring
        }
      ];
    })
  );

  return (
    <div className="universe-map" role="img" aria-label="阅读关系图">
      <svg viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <radialGradient id="universeGlow" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#d9f3ff" stopOpacity="0.35" />
          </radialGradient>
        </defs>
        <rect width={width} height={height} rx="18" fill="url(#universeGlow)" />
        {links.map((link) => {
          const source = positions.get(link.source);
          const target = positions.get(link.target);
          if (!source || !target) return null;
          const active = selectedId && (link.source === selectedId || link.target === selectedId);
          return (
            <line
              key={`${link.source}-${link.target}`}
              x1={source.x}
              x2={target.x}
              y1={source.y}
              y2={target.y}
              stroke={active ? "#d6a23a" : "#8ac9df"}
              strokeOpacity={active ? 0.86 : 0.2}
              strokeWidth={active ? Math.min(8, 2 + link.weight / 1.7) : Math.min(4, 0.8 + link.weight / 2.4)}
            >
              <title>{link.reasons.join(" / ")}</title>
            </line>
          );
        })}
        {books.map((book, index) => {
          const position = positions.get(book.id);
          if (!position) return null;
          const active = selectedId === book.id;
          const connected = connectedToSelected.has(book.id);
          const size = active ? 78 : connected ? 62 : 48;
          const labelVisible = showLabels || active || connected;
          const clipId = `clip-${index}-${String(book.id).replace(/[^a-zA-Z0-9_-]/g, "")}`;
          return (
            <g
              className="universe-node"
              key={book.id}
              onClick={() => onSelect(book.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(book.id);
              }}
              role="button"
              tabIndex={0}
              transform={`translate(${position.x} ${position.y})`}
            >
              <title>{compact([book.title, book.author, book.category])}</title>
              <circle
                r={size / 2 + (active ? 16 : 10)}
                fill={active ? "rgba(214,162,58,0.22)" : connected ? "rgba(25,127,150,0.18)" : "rgba(25,127,150,0.1)"}
              />
              {book.cover ? (
                <>
                  <clipPath id={clipId}>
                    <circle r={size / 2} />
                  </clipPath>
                  <image
                    href={book.cover}
                    x={-size / 2}
                    y={-size / 2}
                    width={size}
                    height={size}
                    clipPath={`url(#${clipId})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <circle r={size / 2} fill={active ? "#d6a23a" : "#197f96"} />
              )}
              <circle r={size / 2} fill="none" stroke={active ? "#d6a23a" : connected ? "#197f96" : "#ffffff"} strokeWidth={active ? 5 : 3} />
              {labelVisible ? (
                <text x="0" y={size / 2 + 24} textAnchor="middle">
                  {book.title.slice(0, active ? 10 : 8)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function getCheckinHighlightText(data: DailyCheckinResult) {
  const highlights = data.items.flatMap((item) => item.highlights);
  return String(highlights[0]?.markText || data.fallbackQuote?.markText || "");
}

function getCheckinReviewText(data: DailyCheckinResult) {
  const reviews = data.items.flatMap((item) => item.reviews);
  return getReviewText(reviews[0] || {});
}

function DailyCheckinSummary({ data, onOpenCheckin }: { data: unknown; onOpenCheckin: () => void }) {
  const result = isDailyCheckinResult(data) ? data : null;

  if (!result) {
    return (
      <div className="message">
        每日打卡数据还没有生成。点击查询后会读取今日阅读时长、最近阅读书籍和今日划线/想法。
      </div>
    );
  }

  const bookNames = result.items.map((item) => item.book.title).filter(Boolean);
  const highlightText = getCheckinHighlightText(result);
  const reviewText = getCheckinReviewText(result);

  return (
    <section className="checkin-summary">
      <div className="checkin-hero">
        <div>
          <p className="eyebrow">每日打卡</p>
          <h2>{result.dateLabel}</h2>
          <p className="hint">
            自动读取今日阅读记录，生成适合发到微信读书群的打卡卡片。所有感悟只保存在本地浏览器。
          </p>
        </div>
        <button className="button primary" onClick={onOpenCheckin} type="button">
          <CalendarCheck size={18} />
          打开打卡弹窗
        </button>
      </div>

      <div className="cards">
        <Metric label="今日阅读" value={result.readSeconds > 0 ? formatDuration(result.readSeconds) : "未达成"} />
        <Metric label="今日相关书籍" value={bookNames.length || result.recommendedBooks.length} />
        <Metric label="今日划线/想法" value={result.items.reduce((sum, item) => sum + item.highlights.length + item.reviews.length, 0)} />
        <Metric label="连续打卡" value={`${Math.max(result.streakDays, getCheckinStreak(result.dateKey))}天`} />
      </div>

      {bookNames.length ? (
        <div className="checkin-book-list">
          {result.items.map((item) => (
            <article className="checkin-book-card" key={item.book.id}>
              <div className="checkin-cover">
                {item.book.cover ? <img src={item.book.cover} alt={item.book.title} loading="lazy" /> : <span>书</span>}
              </div>
              <div>
                <h3>{item.book.title}</h3>
                <p className="meta">{compact([item.book.author, `${item.highlights.length}条划线`, `${item.reviews.length}条想法`])}</p>
                <WereadAppLink className="button ghost" bookId={item.book.id}>
                  继续阅读
                </WereadAppLink>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="message warn">今天还没有匹配到具体阅读书籍。可以打开弹窗查看推荐书并继续阅读。</div>
      )}

      {highlightText || reviewText ? (
        <div className="note-pair checkin-note-preview">
          {highlightText ? <blockquote className="highlight-mark">{highlightText}</blockquote> : null}
          {reviewText ? <blockquote className="thought-mark">{reviewText}</blockquote> : null}
        </div>
      ) : null}
    </section>
  );
}

function DailyCheckinModal({
  data,
  loading,
  error,
  onClose,
  onReload
}: {
  data: DailyCheckinResult | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onReload: () => void;
}) {
  const [reflection, setReflection] = useState("");
  const [displayName, setDisplayName] = useState(() => getCheckinDisplayName());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setReflection(getCheckinReflection(data.dateKey));
      setDisplayName(getCheckinDisplayName());
      setSaved(false);
    }
  }, [data]);

  const hasRead = Boolean(data && data.readSeconds > 0);
  const bookItems = data?.items || [];
  const recommended = data?.recommendedBooks || [];
  const highlightText = data ? getCheckinHighlightText(data) : "";
  const reviewText = data ? getCheckinReviewText(data) : "";
  const streak = data ? Math.max(data.streakDays, getCheckinStreak(data.dateKey)) : 0;

  function skipToday() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHECKIN_LAST_POPUP_STORAGE, data?.dateKey || localDateKey());
    }
    onClose();
  }

  function downloadCard() {
    if (!data) return;
    downloadDailyCheckinImage(data, reflection, displayName);
    setSaved(true);
  }

  return (
    <div className="modal-backdrop no-print" role="presentation" onClick={onClose}>
      <div className="support-modal checkin-modal" role="dialog" aria-modal="true" aria-label="每日打卡" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button" aria-label="关闭">
          ×
        </button>

        <div className="support-heading checkin-heading">
          <div className="support-mark">
            <CalendarCheck size={28} />
          </div>
          <div>
            <span>每日打卡</span>
            <h2>{data?.dateLabel || "今日读书打卡"}</h2>
          </div>
        </div>

        {loading ? <div className="message">正在读取今日阅读记录、最近书籍和划线想法...</div> : null}
        {error ? <div className="message error">{error}</div> : null}

        {!loading && data ? (
          <div className="checkin-modal-body">
            <div className={`checkin-callout ${hasRead ? "success" : "quiet"}`}>
              <div>
                <p className="eyebrow">{hasRead ? "今天已经读书" : "今天还没读书"}</p>
                <h3>{hasRead ? `今日阅读 ${formatDuration(data.readSeconds)}` : "先读几页，再回来打卡也不迟。"}</h3>
              </div>
              <strong>{streak}天连续</strong>
            </div>

            {bookItems.length ? (
              <div className="checkin-book-list">
                {bookItems.map((item) => (
                  <article className="checkin-book-card" key={item.book.id}>
                    <div className="checkin-cover">
                      {item.book.cover ? <img src={item.book.cover} alt={item.book.title} loading="lazy" /> : <span>书</span>}
                    </div>
                    <div>
                      <h3>{item.book.title}</h3>
                      <p className="meta">
                        {compact([item.book.author, `${item.highlights.length}条划线`, `${item.reviews.length}条想法`])}
                      </p>
                      <WereadAppLink className="button ghost" bookId={item.book.id}>
                        继续阅读
                      </WereadAppLink>
                    </div>
                  </article>
                ))}
              </div>
            ) : recommended.length ? (
              <div className="checkin-book-list">
                {recommended.map((book) => (
                  <article className="checkin-book-card" key={book.id}>
                    <div className="checkin-cover">
                      {book.cover ? <img src={book.cover} alt={book.title} loading="lazy" /> : <span>书</span>}
                    </div>
                    <div>
                      <h3>{book.title}</h3>
                      <p className="meta">{compact([book.author, book.updatedAt ? `上次阅读 ${formatDate(book.updatedAt)}` : ""])} </p>
                      <WereadAppLink className="button primary" bookId={book.id}>
                        去微信读书继续阅读
                      </WereadAppLink>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="message">暂时没有可推荐的最近阅读书籍。</div>
            )}

            {highlightText || reviewText ? (
              <div className="note-pair checkin-note-preview">
                {highlightText ? <blockquote className="highlight-mark">{highlightText}</blockquote> : null}
                {reviewText ? <blockquote className="thought-mark">{reviewText}</blockquote> : null}
              </div>
            ) : (
              <div className="message">今天还没有新的划线或想法。卡片会使用今日阅读时长和你的感悟生成。</div>
            )}

            <label className="checkin-reflection">
              <span>今日读书感悟</span>
              <textarea
                value={reflection}
                onChange={(event) => {
                  setReflection(event.target.value);
                  if (data) saveCheckinReflection(data.dateKey, event.target.value);
                }}
                placeholder="写一句今天读书后的想法，生成卡片时会一起放进去。"
              />
            </label>

            <label className="checkin-reflection checkin-display-name">
              <span>微信读书昵称</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例如：止鸢"
              />
              <small>会显示在打卡图片右下角，仅保存在本地浏览器。</small>
            </label>

            {saved ? <div className="message">打卡图片已生成，今天已记录为已打卡。</div> : null}

            <div className="actions checkin-actions">
              <button className="button primary" onClick={downloadCard} type="button" disabled={!data}>
                生成打卡卡片
              </button>
              <button className="button ghost" onClick={onReload} type="button">
                重新读取
              </button>
              <button className="button ghost" onClick={skipToday} type="button">
                今天不再提醒
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AfterwordSummary({ onOpenSupport }: { onOpenSupport: () => void }) {
  return (
    <section className="afterword">
      <div className="afterword-card support-card">
        <div className="afterword-icon">
          <Coffee size={22} />
        </div>
        <div>
          <h3>☕ 打赏支持</h3>
          <p>如果这个小工具帮你把阅读重新收藏起来，可以请作者喝杯咖啡。</p>
          <button className="button primary" onClick={onOpenSupport} type="button">
            <Heart size={17} />
            打开收款码
          </button>
        </div>
      </div>

      <div className="afterword-card">
        <div className="afterword-icon">
          <Info size={22} />
        </div>
        <div>
          <h3>📖 项目说明</h3>
          <p>
            把散落在微信读书里的星光，汇聚成属于自己的银河，感谢来到这里。如果这些阅读记录曾陪伴你，也欢迎支持这个项目继续成长。
          </p>
        </div>
      </div>

      <div className="afterword-card">
        <div className="afterword-icon">
          <Copyright size={22} />
        </div>
        <div>
          <h3>© 版权声明</h3>
          <p>朝夕阅止 版权所有。本网站仅为个人微信读书数据可视化工具，用户数据仅存储于本地浏览器。</p>
        </div>
      </div>
    </section>
  );
}

function SupportModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop no-print" role="presentation" onClick={onClose}>
      <div className="support-modal" role="dialog" aria-modal="true" aria-label="打赏支持" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button" aria-label="关闭">
          ×
        </button>
        <div className="support-heading">
          <div className="support-mark">
            <Heart size={28} />
          </div>
          <div>
            <span>支持</span>
            <h2>请作者喝杯咖啡</h2>
          </div>
        </div>
        <div className="qr-card">
          <div className="wechat-pay-label">推荐使用微信支付</div>
          <img className="support-qr-image" src="/support-wechat.png" alt="微信支付收款码" />
          <strong>微信</strong>
          <p className="hint">微信扫一扫</p>
        </div>
      </div>
    </div>
  );
}

function SearchSummary({
  data,
  onOpenBookDetail
}: {
  data: unknown;
  onOpenBookDetail: (bookId: string) => void;
}) {
  const root = isRecord(data) ? data : {};
  const groups = asArray(root.results);
  const books = groups.flatMap((group) =>
    asArray(group.books).map((item) => ({
      group: group.title || `scope ${group.scope ?? ""}`,
      item,
      book: isRecord(item.bookInfo) ? item.bookInfo : item
    }))
  );

  if (!books.length) return <div className="message">没有找到可展示的搜索结果。</div>;

  return (
    <div className="list">
      {books.map(({ group, item, book }, index) => (
        <div className="item" key={`${book.bookId ?? index}-${index}`}>
          <div className="item-title">
            {index + 1}. {getBookTitle(book)}
            <span className="pill">{String(group)}</span>
          </div>
          <div className="meta">
            {compact([
              getBookAuthor(book),
              formatRating(item.newRating ?? book.newRating),
              item.readingCount ? `${item.readingCount}人在读` : "",
              book.category,
              item.searchIdx !== undefined ? `searchIdx ${item.searchIdx}` : ""
            ])}
          </div>
          {book.bookId ? <WereadAppLink bookId={book.bookId}>{String(book.bookId)} · 打开微信读书</WereadAppLink> : null}
          {book.bookId ? (
            <div className="actions">
              <button className="button ghost" onClick={() => onOpenBookDetail(String(book.bookId))} type="button">
                查看详情
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReadingAnalysisSummary({ data, onPrint }: { data: unknown; onPrint: () => void }) {
  const root = isRecord(data) ? data : {};
  const timeEntries = entriesFromTimeMap(root.dailyReadTimes).length
    ? entriesFromTimeMap(root.dailyReadTimes)
    : entriesFromTimeMap(root.readTimes);
  const maxTime = Math.max(...timeEntries.map((item) => item.seconds), 1);
  const categories = asArray(root.preferCategory);
  const readStat = asArray(root.readStat);
  const readLongest = asArray(root.readLongest);
  const hasCategoryWeight = categories.some((item) => normalizeRatio(item.val) > 0);
  const totalCategoryTime = categories.reduce((total, item) => total + Math.max(0, Number(item.readingTime) || 0), 0);
  const preferTime = Array.isArray(root.preferTime) ? root.preferTime.map((value) => Number(value) || 0) : [];
  const maxPreferTime = Math.max(...preferTime, 1);
  const longestDay = timeEntries.reduce((max, item) => Math.max(max, item.seconds), 0);
  const topCategory = categories[0];
  const reportLines = [
    `总阅读时长：${formatDuration(root.totalReadTime) || "-"}`,
    `阅读天数：${root.readDays ?? "-"}`,
    `日均阅读：${formatDuration(root.dayAverageReadTime) || "-"}`,
    `最长单日：${formatDuration(longestDay) || "-"}`,
    `偏好类别：${topCategory?.categoryTitle || topCategory?.parentCategoryTitle || "-"}`
  ];

  return (
    <article className="analysis-dashboard print-export">
      <div className="export-toolbar no-print">
        <div>
          <h2>阅读分析与复盘工具</h2>
          <p className="hint">阅读热力图、类别偏好、阅读习惯和阶段复盘报告。</p>
        </div>
        <div className="actions">
          <button className="button ghost" onClick={() => downloadTextImage("阅读复盘报告", reportLines)} type="button">
            <Download size={17} />
            生成分享图
          </button>
          <button className="button primary" onClick={onPrint} type="button">
            <Download size={17} />
            导出 PDF
          </button>
        </div>
      </div>

      <div className="cards">
        <Metric label="总阅读时长" value={formatDuration(root.totalReadTime) || "-"} />
        <Metric label="阅读天数" value={root.readDays ?? "-"} />
        <Metric label="日均阅读" value={formatDuration(root.dayAverageReadTime) || "-"} />
        <Metric label="最长单日" value={formatDuration(longestDay) || "-"} />
      </div>

      <section className="analysis-section">
        <div>
          <h3>阅读统计概览</h3>
          <p className="hint">原“阅读统计”已并入这里，集中查看阅读条目、读得最久的书和分类摘要。</p>
        </div>
        <div className="stat-chip-grid">
          {readStat.map((item, index) => (
            <div className="stat-chip" key={`stat-${index}`}>
              <strong>{item.stat || "统计"}</strong>
              <span>{item.counts || "-"}</span>
            </div>
          ))}
          {!readStat.length ? <div className="message">这个周期暂时没有统计条目。</div> : null}
        </div>
        {readLongest.length ? (
          <div className="list">
            {readLongest.slice(0, 6).map((item, index) => {
              const book = isRecord(item.book) ? item.book : isRecord(item.albumInfo) ? item.albumInfo : {};
              return (
                <div className="item" key={`longest-${index}`}>
                  <div className="item-title">{getBookTitle(book)}</div>
                  <div className="meta">{compact([getBookAuthor(book), formatDuration(item.readTime)])}</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="analysis-section">
        <div>
          <h3>阅读热力图</h3>
          <p className="hint">按天/月/年展示阅读时长柱状分布。</p>
        </div>
        {timeEntries.length ? (
          <div className="heat-grid">
            {timeEntries.map((item) => {
              const dateLabel = formatDate(Number(item.key)) || item.key;
              const height = Math.max(6, (item.seconds / maxTime) * 100);
              return (
                <div
                  className="heat-cell"
                  key={item.key}
                  title={`${dateLabel} · ${formatDuration(item.seconds) || "0分钟"}`}
                >
                  <span className="heat-value">{formatDuration(item.seconds) || "0分钟"}</span>
                  <span className="heat-bar" style={{ height: `${height}%` }} />
                  <span className="heat-label">{formatTimeBucketLabel(item.key)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="message">这个周期没有可展示的阅读时间分布。</div>
        )}
      </section>

      <section className="analysis-section">
        <div>
          <h3>书籍偏好分析</h3>
          <p className="hint">按分类阅读时长计算比例。</p>
        </div>
        <div className="preference-list">
          {categories.slice(0, 8).map((item, index) => {
            const label = item.categoryTitle || item.parentCategoryTitle || `分类 ${index + 1}`;
            const readingTime = Math.max(0, Number(item.readingTime) || 0);
            const weight = hasCategoryWeight ? normalizeRatio(item.val) : totalCategoryTime > 0 ? readingTime / totalCategoryTime : 0;
            const displayPercent = totalCategoryTime > 0 ? readingTime / totalCategoryTime : weight;
            return (
              <div className="preference-row" key={`${label}-${index}`}>
                <div>
                  <strong>{label}</strong>
                  <span>{compact([formatDuration(item.readingTime), item.readingCount ? `${item.readingCount}本` : ""])}</span>
                </div>
                <div className="bar-track">
                  <span style={{ width: weight > 0 ? `${Math.max(4, Math.min(100, weight * 100))}%` : "0%" }} />
                </div>
                <small>{compact([formatRatio(displayPercent), formatDuration(readingTime)])}</small>
              </div>
            );
          })}
          {!categories.length ? <div className="message">这个周期还没有偏好分类数据。</div> : null}
        </div>
      </section>

      <section className="analysis-section">
        <div>
          <h3>阅读习惯追踪</h3>
          <p className="hint">分析阅读时段、日均阅读和高峰阅读时间。</p>
        </div>
        {preferTime.length ? (
          <div className="hour-bars">
            {preferTime.map((seconds, index) => {
              const hour = (index + 6) % 24;
              return (
                <div className="hour-bar" key={hour}>
                  <span style={{ height: `${Math.max(4, (seconds / maxPreferTime) * 100)}%` }} />
                  <small>{hour}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="message">这个周期暂时没有阅读时段数据。</div>
        )}
        <p className="hint">{compact([root.preferTimeWord, root.preferCategoryWord, root.compare ? `较上期 ${formatPercent(root.compare)}` : ""])}</p>
      </section>

      <section className="analysis-section report-card">
        <div>
          <h3>年度/季度阅读报告</h3>
          <p className="hint">当前按所选周期生成复盘摘要；季度报告后续可通过多个月度数据合并增强。</p>
        </div>
        <ul>
          {reportLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function ShelfSummary({
  data,
  onOpenBookDetail
}: {
  data: unknown;
  onOpenBookDetail: (bookId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [readFilter, setReadFilter] = useState<"all" | "reading" | "done">("all");
  const [sortBy, setSortBy] = useState<"recent" | "notes" | "title">("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<ShelfItem | null>(null);

  const root = isRecord(data) ? data : {};
  const books = asArray(root.books);
  const albums = asArray(root.albums);
  const mpCount = root.mp ? 1 : 0;
  const total = books.length + albums.length + mpCount;
  const items = normalizeShelfItems(root);
  const categories = ["全部", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean))).slice(0, 18)];
  const filtered = items
    .filter((item) => {
      const haystack = `${item.title} ${item.author} ${item.category}`.toLowerCase();
      const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
      const matchesCategory = category === "全部" || item.category === category;
      const matchesRead =
        readFilter === "all" || (readFilter === "done" ? item.finished : item.type === "book" && !item.finished);
      return matchesQuery && matchesCategory && matchesRead;
    })
    .sort((a, b) => {
      if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
      if (sortBy === "title") return a.title.localeCompare(b.title, "zh-CN");
      return b.updatedAt - a.updatedAt;
    });

  return (
    <section className="bookshelf">
      <div className="cards">
        <Metric label="书架总条目" value={total} />
        <Metric label="电子书" value={books.length} />
        <Metric label="专辑/有声书" value={albums.length} />
        <Metric label="文章收藏入口" value={mpCount} />
      </div>

      <div className="shelf-toolbar no-print">
        <div className="shelf-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名或作者" />
        </div>
        <div className="segmented">
          <button className={sortBy === "recent" ? "active" : ""} onClick={() => setSortBy("recent")} type="button">
            最近阅读
          </button>
          <button className={sortBy === "title" ? "active" : ""} onClick={() => setSortBy("title")} type="button">
            书名
          </button>
        </div>
        <div className="segmented">
          <button className={readFilter === "all" ? "active" : ""} onClick={() => setReadFilter("all")} type="button">
            全部
          </button>
          <button
            className={readFilter === "reading" ? "active" : ""}
            onClick={() => setReadFilter("reading")}
            type="button"
          >
            未读完
          </button>
          <button className={readFilter === "done" ? "active" : ""} onClick={() => setReadFilter("done")} type="button">
            已读完
          </button>
        </div>
        <div className="icon-toggle">
          <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")} type="button">
            <List size={18} />
          </button>
          <button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")} type="button">
            <Grid2X2 size={18} />
          </button>
        </div>
      </div>

      <div className="category-row no-print">
        {categories.map((name) => (
          <button className={category === name ? "active" : ""} key={name} onClick={() => setCategory(name)} type="button">
            {name}
          </button>
        ))}
      </div>

      <div className={viewMode === "grid" ? "cover-grid" : "cover-list"}>
        {filtered.map((item) => (
          <button className="cover-card" key={`${item.type}-${item.id}`} onClick={() => setSelected(item)} type="button">
            <div className="cover-frame">
              {item.cover ? <img src={item.cover} alt={item.title} loading="lazy" /> : <span>{item.type === "mp" ? "文" : "书"}</span>}
            </div>
            <div className="cover-title">{item.title}</div>
            <div className="cover-meta">{compact([item.author, item.category])}</div>
          </button>
        ))}
      </div>

      {!filtered.length ? <div className="message">没有匹配的书架条目。</div> : null}

      {selected ? (
        <div className="detail-drawer">
          <div>
            <h3>{selected.title}</h3>
            <p className="hint">
              {compact([
                selected.author,
                selected.category,
                selected.finished ? "已读完" : selected.type === "book" ? "未读完" : "",
                selected.secret ? "私密" : "公开",
                formatDate(selected.updatedAt)
              ])}
            </p>
          </div>
          <div className="actions">
            {selected.type === "book" && selected.id ? (
              <WereadAppLink className="button primary" bookId={selected.id}>
                继续阅读
              </WereadAppLink>
            ) : null}
            {selected.type === "book" && selected.id ? (
              <button className="button ghost" onClick={() => onOpenBookDetail(selected.id)} type="button">
                查看详情
              </button>
            ) : null}
            <button className="button ghost" onClick={() => setSelected(null)} type="button">
              关闭
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NotesSummary({
  data,
  onSelectNotebook,
  noteDetails,
  noteLoading,
  noteError,
  onPrint,
  onMarkdown,
  onEpub
}: {
  data: unknown;
  onSelectNotebook: (notebook: NoteNotebook) => void;
  noteDetails: NoteDetails | null;
  noteLoading: boolean;
  noteError: string;
  onPrint: () => void;
  onMarkdown: () => void;
  onEpub: () => void;
}) {
  const [query, setQuery] = useState("");
  const root = isRecord(data) ? data : {};
  const notebooks = asArray(root.books) as NoteNotebook[];
  const filtered = notebooks.filter((item) => {
    const book = getNotebookBook(item);
    const haystack = `${getBookTitle(book)} ${getBookAuthor(book)}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  });

  return (
    <section className="notes-workspace">
      <aside className="notes-sidebar no-print">
        <div className="cards compact-cards">
          <Metric label="有笔记书籍" value={root.totalBookCount ?? notebooks.length} />
          <Metric label="笔记总条数" value={root.totalNoteCount ?? "-"} />
        </div>
        <div className="shelf-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名或作者" />
        </div>
        <div className="notebook-list">
          {filtered.map((item, index) => {
            const book = getNotebookBook(item);
            return (
              <button
                className={
                  noteDetails && getNotebookBookId(noteDetails.notebook) === getNotebookBookId(item)
                    ? "notebook-row active"
                    : "notebook-row"
                }
                key={`${getNotebookBookId(item) || index}-${index}`}
                onClick={() => onSelectNotebook(item)}
                type="button"
              >
                <span>{getBookTitle(book)}</span>
                <small>{compact([getBookAuthor(book), `${getNotebookTotal(item)}条`])}</small>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="notes-detail">
        {noteLoading ? <div className="message no-print">正在读取单本书笔记...</div> : null}
        {noteError ? <div className="message error no-print">{noteError}</div> : null}
        {!noteLoading && !noteDetails ? (
          <div className="message no-print">点击左侧一本书，右侧会直接显示划线和想法。</div>
        ) : null}
        {noteDetails ? (
          <NoteExportView details={noteDetails} onPrint={onPrint} onMarkdown={onMarkdown} onEpub={onEpub} />
        ) : null}
      </div>
    </section>
  );
}

function NoteExportView({
  details,
  onPrint,
  onMarkdown,
  onEpub
}: {
  details: NoteDetails;
  onPrint: () => void;
  onMarkdown: () => void;
  onEpub: () => void;
}) {
  const [cardDraft, setCardDraft] = useState<NoteCardDraft | null>(null);
  const book = getNotebookBook(details.notebook);
  const chapters = asArray((details.bookmarkData as AnyRecord)?.chapters);
  const highlights = asArray((details.bookmarkData as AnyRecord)?.updated);
  const reviews = asArray((details.reviewData as AnyRecord)?.reviews).map(extractMineReview);
  const { pairs, unmatchedReviews } = pairNotes(chapters, highlights, reviews);
  const makeCardDraft = (input: {
    id: string;
    chapterTitle?: string;
    meta?: string;
    highlight?: string;
    thought?: string;
  }): NoteCardDraft => ({
    id: input.id,
    bookTitle: getBookTitle(book),
    author: getBookAuthor(book),
    chapterTitle: input.chapterTitle || "",
    meta: input.meta || "",
    highlight: input.highlight || "",
    thought: input.thought || ""
  });

  return (
    <article className="print-export">
      <div className="export-toolbar no-print">
        <div>
          <h2>{getBookTitle(book)}</h2>
          <p className="hint">{compact([getBookAuthor(book), `${highlights.length}条划线`, `${reviews.length}条想法/点评`])}</p>
        </div>
        <div className="actions">
          <button className="button ghost" onClick={onMarkdown} type="button">
            <Download size={17} />
            导出 Markdown
          </button>
          <button className="button ghost" onClick={onEpub} type="button">
            <Download size={17} />
            导出 EPUB
          </button>
          <button className="button primary" onClick={onPrint} type="button">
            <Download size={17} />
            导出 PDF
          </button>
        </div>
      </div>

      <header className="print-header">
        <h1>{getBookTitle(book)}</h1>
        <p>{compact([`作者：${getBookAuthor(book) || "-"}`, `导出时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`])}</p>
        <p>
          {Number(details.notebook.noteCount || 0)} 条划线 · {Number(details.notebook.reviewCount || 0)} 条想法/点评 ·{" "}
          {Number(details.notebook.bookmarkCount || 0)} 个书签
        </p>
      </header>

      <section className="note-section paired-notes">
        <h2>划线与想法</h2>
        {cardDraft ? <NoteCardGenerator draft={cardDraft} onClose={() => setCardDraft(null)} /> : null}
        {!pairs.length && !unmatchedReviews.length ? (
          <div className="message">这本书没有可展示的划线、想法或点评。</div>
        ) : null}
        {pairs.map((pair) => (
          <div className="note-pair" key={pair.id}>
            <div className="note-pair-top no-print">
              <div className="note-meta">
                {compact([pair.chapterTitle, formatDateTime(pair.createTime), pair.range])}
              </div>
              <button
                className="button ghost note-card-button"
                onClick={() =>
                  setCardDraft(
                    makeCardDraft({
                      id: pair.id,
                      chapterTitle: pair.chapterTitle,
                      meta: compact([pair.chapterTitle, formatDateTime(pair.createTime), pair.range]),
                      highlight: String(pair.highlight.markText || ""),
                      thought: pair.reviews.map(getReviewText).filter(Boolean).join("\n\n")
                    })
                  )
                }
                type="button"
              >
                生成卡片
              </button>
            </div>
            <div className="note-meta print-only">
              {compact([pair.chapterTitle, formatDateTime(pair.createTime), pair.range])}
            </div>
            <blockquote className="highlight-mark">{pair.highlight.markText || ""}</blockquote>
            {pair.reviews.map((review, index) => (
              <div className="thought-mark" key={`${review.reviewId || pair.id}-${index}`}>
                <div className="note-meta">
                  {compact([review.chapterName || pair.chapterTitle, formatDateTime(review.createTime), getNoteRange(review)])}
                </div>
                <p>{getReviewText(review)}</p>
              </div>
            ))}
          </div>
        ))}
      </section>

      {unmatchedReviews.length ? (
        <section className="note-section">
          <h2>未匹配想法/整本书点评</h2>
          {unmatchedReviews.map((review, index) => (
            <div className="note-pair standalone-thought" key={`${review.reviewId || index}-${index}`}>
              <div className="note-pair-top no-print">
                <div className="note-meta">
                  {compact([review.chapterName || "整本书", formatDateTime(review.createTime), getNoteRange(review)])}
                </div>
                <button
                  className="button ghost note-card-button"
                  onClick={() =>
                    setCardDraft(
                      makeCardDraft({
                        id: String(review.reviewId || index),
                        chapterTitle: String(review.chapterName || "整本书"),
                        meta: compact([review.chapterName || "整本书", formatDateTime(review.createTime), getNoteRange(review)]),
                        thought: getReviewText(review)
                      })
                    )
                  }
                  type="button"
                >
                  生成卡片
                </button>
              </div>
              <div className="thought-mark">
                <div className="note-meta">
                  {compact([review.chapterName || "整本书", formatDateTime(review.createTime), getNoteRange(review)])}
                </div>
                <p>{getReviewText(review)}</p>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </article>
  );
}

function NoteCardGenerator({ draft, onClose }: { draft: NoteCardDraft; onClose: () => void }) {
  const [template, setTemplate] = useState<CardTemplate>("minimal");
  const [showBook, setShowBook] = useState(true);
  const [showMeta, setShowMeta] = useState(true);
  const [showSignature, setShowSignature] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [signature, setSignature] = useState("朝夕阅止");

  return (
    <section className={`card-generator card-template-${template} no-print`}>
      <div className="card-generator-head">
        <div>
          <h3>读书笔记卡片生成器</h3>
          <p className="hint">选择模板后下载 PNG，内容只在本地浏览器生成。</p>
        </div>
        <button className="button ghost" onClick={onClose} type="button">
          关闭
        </button>
      </div>

      <div className="template-grid">
        {cardTemplates.map((item) => (
          <button
            className={template === item.id ? "template-card active" : "template-card"}
            key={item.id}
            onClick={() => setTemplate(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="card-preview-shell">
        <article className="note-card-preview">
          {showBook ? (
            <header>
              <h2>{draft.bookTitle}</h2>
              <p>{draft.author || "微信读书"}</p>
            </header>
          ) : null}
          {showMeta && draft.meta ? <p className="card-preview-meta">{draft.meta}</p> : null}
          {draft.highlight ? <blockquote>{draft.highlight}</blockquote> : null}
          {draft.thought ? <div className="card-preview-thought">{draft.thought}</div> : null}
          <footer>
            {showSignature ? <span>- {signature || "朝夕阅止"}</span> : <span />}
            {showBrand ? <strong>朝夕阅止 · WeRead Web</strong> : null}
          </footer>
        </article>
      </div>

      <div className="card-options">
        <label>
          <input type="checkbox" checked={showBook} onChange={(event) => setShowBook(event.target.checked)} />
          显示书名作者
        </label>
        <label>
          <input type="checkbox" checked={showMeta} onChange={(event) => setShowMeta(event.target.checked)} />
          显示章节/时间
        </label>
        <label>
          <input type="checkbox" checked={showSignature} onChange={(event) => setShowSignature(event.target.checked)} />
          显示署名
        </label>
        <label>
          <input type="checkbox" checked={showBrand} onChange={(event) => setShowBrand(event.target.checked)} />
          显示站点标识
        </label>
        <div className="signature-field">
          <span>署名</span>
          <input value={signature} onChange={(event) => setSignature(event.target.value)} />
        </div>
      </div>

      <div className="actions">
        <button
          className="button primary"
          onClick={() =>
            downloadNoteCardImage(draft, {
              template,
              showBook,
              showMeta,
              showSignature,
              showBrand,
              signature
            })
          }
          type="button"
        >
          <Download size={17} />
          下载图片
        </button>
      </div>
    </section>
  );
}

function BookLookupSummary({
  data,
  onOpenBookDetail,
  onOpenBookChapters,
  onOpenBookNotes
}: {
  data: unknown;
  onOpenBookDetail: (bookId: string, fallbackBook?: AnyRecord) => void;
  onOpenBookChapters: (bookId: string) => void;
  onOpenBookNotes: (book: AnyRecord) => void;
}) {
  const lookup = isBookLookupResult(data) ? data : null;
  const matches = lookup
    ? mergeBookMatches(extractShelfBookMatches(lookup.shelfData, lookup.query), extractSearchBookMatches(lookup.searchData))
    : [];
  const detail = lookup ? lookup.detailData : data;

  return (
    <section className="book-lookup">
      {matches.length ? (
        <aside className="book-candidates no-print">
          <div>
            <h3>搜索结果</h3>
            <p className="hint">已自动打开第一本；也可以切换候选书。</p>
          </div>
          <div className="candidate-list">
            {matches.slice(0, 12).map((match, index) => (
              <button
                className={lookup?.selectedBookId === match.bookId ? "candidate active" : "candidate"}
                key={`${match.bookId}-${index}`}
                onClick={() => onOpenBookDetail(match.bookId, match.book)}
                type="button"
              >
                {match.book.cover ? <img src={String(match.book.cover)} alt={match.title} loading="lazy" /> : <span>书</span>}
                <strong>{match.title}</strong>
                <small>{compact([match.author, match.group, match.book.category, formatRating(match.item.newRating ?? match.book.newRating), `bookId ${match.bookId}`])}</small>
              </button>
            ))}
          </div>
        </aside>
      ) : null}
      <div className="book-lookup-detail">
        <BookSummary data={detail} onOpenBookChapters={onOpenBookChapters} onOpenBookNotes={onOpenBookNotes} />
      </div>
    </section>
  );
}

function BookSummary({
  data,
  onOpenBookChapters,
  onOpenBookNotes
}: {
  data: unknown;
  onOpenBookChapters: (bookId: string) => void;
  onOpenBookNotes: (book: AnyRecord) => void;
}) {
  const book = isRecord(data) ? data : {};
  const currentBookId = String(book.bookId || "");

  return (
    <section className="book-detail">
      <div className="book-hero">
        <div className="book-cover-large">
          {book.cover ? <img src={String(book.cover)} alt={getBookTitle(book)} /> : <span>书</span>}
        </div>
        <div className="book-info">
          <h2>{getBookTitle(book)}</h2>
          <p className="book-author">{compact([getBookAuthor(book), book.translator ? `译者 ${book.translator}` : ""])}</p>
          <div className="meta">
            {compact([
              book.category,
              book.publisher,
              book.publishTime,
              formatRating(book.newRating),
              book.newRatingCount ? `${book.newRatingCount}人评分` : "",
              book.wordCount ? `${book.wordCount}字` : ""
            ])}
          </div>
          <div className="actions">
            {currentBookId ? (
              <WereadAppLink className="button primary" bookId={currentBookId}>
                继续阅读
              </WereadAppLink>
            ) : null}
            {currentBookId ? (
              <button className="button ghost" onClick={() => onOpenBookChapters(currentBookId)} type="button">
                查看章节目录
              </button>
            ) : null}
            {currentBookId ? (
              <button className="button ghost" onClick={() => onOpenBookNotes(book)} type="button">
                查看笔记
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {book.intro ? (
        <div className="book-intro">
          <h3>简介</h3>
          <p>{String(book.intro)}</p>
        </div>
      ) : null}
    </section>
  );
}

function ProgressSummary({
  data,
  onOpenProgress
}: {
  data: unknown;
  onOpenProgress: (match: SearchBookMatch) => void;
}) {
  const lookup = isProgressLookupResult(data) ? data : null;
  const root = isRecord(lookup?.progressData) ? lookup.progressData : isRecord(data) ? data : {};
  const book = isRecord(root.book) ? root.book : root;
  const selectedBook = lookup?.selectedBook && isRecord(lookup.selectedBook) ? lookup.selectedBook : {};
  const progressBookId = lookup?.selectedBookId || root.bookId || book.bookId || selectedBook.bookId;
  const displayBook = Object.keys(selectedBook).length ? selectedBook : book;
  const readSeconds = firstNumber(
    book.recordReadingTime,
    root.recordReadingTime,
    book.readingTime,
    root.readingTime,
    book.totalReadTime,
    root.totalReadTime,
    book.readTime,
    root.readTime,
    book.bookReadTime,
    root.bookReadTime
  );
  const candidates = lookup
    ? mergeBookMatches(extractShelfBookMatches(lookup.shelfData, lookup.query), extractSearchBookMatches(lookup.searchData))
    : [];

  return (
    <section className="progress-summary">
      {progressBookId ? (
        <div className="progress-book-card">
          <div className="progress-cover">
            {displayBook.cover ? <img src={String(displayBook.cover)} alt={getBookTitle(displayBook)} /> : <span>书</span>}
          </div>
          <div>
            <h3>{getBookTitle(displayBook)}</h3>
            <p className="meta">{compact([getBookAuthor(displayBook), displayBook.category, progressBookId ? `bookId ${progressBookId}` : ""])}</p>
            <p className="hint">阅读进度按当前选中的 bookId 查询；导入书和官方书 bookId 不同，优先匹配“我的书架”里的同名书。</p>
            <div className="actions">
              <WereadAppLink className="button primary" bookId={progressBookId} chapterUid={book.chapterUid}>
              继续阅读
              </WereadAppLink>
            </div>
          </div>
        </div>
      ) : null}
      <div className="cards">
        <Metric label="阅读进度" value={book.progress !== undefined ? `${book.progress}%` : "-"} />
        <Metric label="累计阅读" value={readSeconds !== undefined ? formatDuration(readSeconds) : "-"} />
        <Metric label="最后阅读" value={formatDate(book.updateTime || root.updateTime) || "-"} />
        <Metric label="读完时间" value={formatDate(book.finishTime || root.finishTime) || "-"} />
      </div>
      {candidates.length > 1 ? (
        <div className="progress-candidates no-print">
          <h3>同名候选</h3>
          <p className="hint">如果进度看起来不对，通常是导入书和官方书同名但 bookId 不同。这里把两类结果都列出来方便核对。</p>
          <div className="candidate-list">
            {candidates.slice(0, 12).map((match, index) => (
              <div className={String(progressBookId) === match.bookId ? "candidate active" : "candidate"} key={`${match.bookId}-${index}`}>
                {match.book.cover ? <img src={String(match.book.cover)} alt={match.title} loading="lazy" /> : <span>书</span>}
                <strong>{match.title}</strong>
                <small>{compact([match.author, match.group, match.book.category, `bookId ${match.bookId}`])}</small>
                <button className="button ghost candidate-action" onClick={() => onOpenProgress(match)} type="button">
                  查看此书进度
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ChaptersSummary({ data, bookId }: { data: unknown; bookId: string }) {
  const root = isRecord(data) ? data : {};
  const chapters = asArray(root.chapters);

  if (!chapters.length) return <div className="message">没有章节数据。</div>;

  return (
    <div className="list">
      {chapters.map((chapter, index) => (
        <div
          className="item"
          key={`${chapter.chapterUid ?? index}-${index}`}
          style={{ marginLeft: `${Math.max(Number(chapter.level || 1) - 1, 0) * 16}px` }}
        >
          <div className="item-title">{chapter.title || `章节 ${index + 1}`}</div>
          <div className="meta">
            {compact([
              chapter.chapterUid ? `chapterUid ${chapter.chapterUid}` : "",
              chapter.wordCount ? `${chapter.wordCount}字` : "",
              chapter.price ? `价格 ${chapter.price}` : "免费",
              chapter.paid ? "已购买" : "",
              formatDate(chapter.updateTime)
            ])}
          </div>
          {chapter.chapterUid ? (
            <WereadAppLink bookId={bookId || root.bookId} chapterUid={chapter.chapterUid}>
              打开章节
            </WereadAppLink>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReviewsSummary({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {};
  const reviews = asArray(root.reviews);

  return (
    <>
      <div className="cards">
        <Metric label="点评总数" value={root.reviewsCnt ?? "-"} />
        <Metric label="最新评论数" value={root.recentTotalCnt ?? "-"} />
        <Metric label="还有更多" value={root.reviewsHasMore ? "是" : "否"} />
        <Metric label="synckey" value={root.synckey ?? "-"} />
      </div>
      <div className="list">
        {reviews.map((item, index) => {
          const wrapper = isRecord(item.review) ? item.review : item;
          const review = isRecord(wrapper.review) ? wrapper.review : wrapper;
          const author = isRecord(review.author) ? review.author : {};
          return (
            <div className="item" key={`${review.reviewId ?? index}-${index}`}>
              <div className="item-title">{author.name || "读者点评"}</div>
              <div className="meta">
                {compact([
                  review.star ? `${Number(review.star) / 20}星` : "",
                  review.isFinish ? "已读完" : "",
                  review.chapterName,
                  formatDate(review.createTime),
                  item.idx !== undefined ? `maxIdx ${item.idx}` : ""
                ])}
              </div>
              <p className="hint">{String(review.content || review.htmlContent || "").slice(0, 220)}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DiscoverSummary({
  data,
  onOpenBookDetail
}: {
  data: unknown;
  onOpenBookDetail: (bookId: string) => void;
}) {
  const root = isRecord(data) ? data : {};
  const isSmart = root.__kind === "smartDiscover";
  const books = isSmart ? asArray(root.books) : asArray(root.books);
  const basis = isSmart && isRecord(root.basis) ? root.basis : {};

  if (!books.length) return <div className="message">没有推荐结果。</div>;

  return (
    <section className="smart-discover">
      {isSmart ? (
        <div className="recommend-basis">
          <div>
            <h3>按你的阅读偏好推荐</h3>
            <p className="hint">
              {compact([
                asStringArray(basis.categories).length ? `偏好分类：${asStringArray(basis.categories).join("、")}` : "",
                asStringArray(basis.seedBooks).length ? `参考书：${asStringArray(basis.seedBooks).join("、")}` : "",
                basis.shelfBookCount ? `已避开书架 ${basis.shelfBookCount} 本` : ""
              ])}
            </p>
          </div>
          <div className="basis-tags">
            {asStringArray(basis.sources).map((source, index) => (
              <span className="pill" key={`${source}-${index}`}>
                {source}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="recommend-grid">
        {books.map((book, index) => {
          const bookId = getBookId(book);
          return (
            <article className="recommend-card" key={`${bookId || index}-${index}`}>
              <div className="recommend-cover">
                {book.cover ? <img src={String(book.cover)} alt={getBookTitle(book)} loading="lazy" /> : <span>书</span>}
              </div>
              <div className="recommend-body">
                <h3>{getBookTitle(book)}</h3>
                <div className="meta">
                  {compact([
                    getBookAuthor(book),
                    formatRating(book.newRating),
                    book.readingCount ? `${book.readingCount}人在读` : "",
                    book.category,
                    book.searchIdx !== undefined ? `maxIdx ${book.searchIdx}` : ""
                  ])}
                </div>
                <p className="hint">
                  {String(book.__smartReason || book.reason || book.intro || "与你的阅读偏好相关。").slice(0, 110)}
                </p>
                <div className="actions">
                  {bookId ? (
                    <button className="button ghost" onClick={() => onOpenBookDetail(bookId)} type="button">
                      查看详情
                    </button>
                  ) : null}
                  {bookId ? (
                    <WereadAppLink className="button primary" bookId={bookId}>
                      打开微信读书
                    </WereadAppLink>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}
