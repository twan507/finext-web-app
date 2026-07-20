'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * MỘT chu kỳ mời chat do JS điều khiển: tới nhịp thì nút tròn nhún đúng một cái
 * VÀ bong bóng tự hiện cùng lúc — không còn hai nhịp rời nhau (animation lặp vô hạn
 * chạy một đằng, bộ đếm popup chạy một nẻo).
 *
 * Hover KHÔNG đi qua đây: hover hiện bong bóng ngay và không tính vào trần mời.
 */
const FIRST_DELAY_MS = 8_000; // im lặng lúc mới vào để user kịp nhìn trang
const REPEAT_GAP_MS = 45_000; // nghỉ giữa hai lượt mời, tính từ lúc bong bóng tắt
const VISIBLE_MS = 5_000; // bong bóng tự hiện bao lâu, không cần hover
const MAX_SHOWS = 4; // trần cứng mỗi phiên — mời quá số này là làm phiền

/** Độ dài đúng một nhịp nhún; nút tròn dùng luôn số này cho animation của nó. */
export const NUDGE_MS = 1_100;

const DISMISS_KEY = 'finext.bubbleTeaser.dismissed';
const COUNT_KEY = 'finext.bubbleTeaser.count';

function readFlag(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null; // sessionStorage bị chặn (chế độ riêng tư) → coi như chưa có cờ
  }
}

function writeFlag(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Không ghi được thì thôi, không phải lỗi chặn luồng.
  }
}

/** Ngừng MỜI TỰ ĐỘNG trong suốt phiên. Lối vào công khai là `stop()` của hook. */
function dismissTeaser(): void {
  writeFlag(DISMISS_KEY, '1');
}

export interface TeaserCycle {
  /** Bong bóng đang tự hiện theo chu kỳ (khác với hiện do hover). */
  autoVisible: boolean;
  /** Nút tròn đang trong đúng một nhịp nhún. */
  nudging: boolean;
  /** Tăng một đơn vị mỗi lượt mời — dùng làm mốc để đổi câu mời. */
  turn: number;
  /** Tắt hẳn chu kỳ cả phiên và ẩn ngay bong bóng đang hiện. */
  stop: () => void;
}

/** `enabled`: chỉ chạy khi trang có bubble, user đã đăng nhập và cửa sổ chat đang đóng. */
export default function useTeaserCycle(enabled: boolean): TeaserCycle {
  const [autoVisible, setAutoVisible] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    if (!enabled || readFlag(DISMISS_KEY)) return;
    const pending = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        pending.delete(id);
        fn();
      }, ms);
      pending.add(id);
    };

    const schedule = (delay: number) =>
      later(() => {
        const shown = Number(readFlag(COUNT_KEY)) || 0;
        if (readFlag(DISMISS_KEY) || shown >= MAX_SHOWS) return; // hết chu kỳ, không hẹn tiếp
        writeFlag(COUNT_KEY, String(shown + 1));
        setTurn((n) => n + 1); // mốc để lớp trên bốc câu mời khác
        setNudging(true);
        setAutoVisible(true);
        later(() => setNudging(false), NUDGE_MS);
        later(() => {
          setAutoVisible(false);
          schedule(REPEAT_GAP_MS);
        }, VISIBLE_MS);
      }, delay);

    schedule(FIRST_DELAY_MS);
    return () => {
      pending.forEach((id) => clearTimeout(id));
      pending.clear();
    };
  }, [enabled]);

  const stop = useCallback(() => {
    dismissTeaser(); // hẹn giờ còn treo sẽ tự dừng khi thấy cờ này
    setAutoVisible(false);
    setNudging(false);
  }, []);

  return { autoVisible, nudging, turn, stop };
}
