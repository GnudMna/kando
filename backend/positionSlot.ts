/** 並び順の初期間隔。 */
const POSITION_GAP = 1000;

/** カラム内または行内の既存アイテム。 */
export type PositionSlot = {
  id: number;
  position: number;
};

/**
 * 二つの position が浮動小数の精度で区別できないかを返す。
 * @param left - 比較する値
 * @param right - 比較する値
 * @returns 同一とみなす場合は true
 */
function tooClose(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= scale * 1e-9;
}

/**
 * 希望位置が既存と衝突しないときはその値を使い、衝突するか間隔が潰れているときは
 * 並び全体を 1000 刻みに振り直す。
 * @param slots - ロック済みの既存アイテム
 * @param movingId - 移動対象の ID。新規追加では `null`
 * @param requested - クライアントが希望する position
 * @returns 採用する position と、他アイテムの振り直し
 */
export function assignPosition(
  slots: PositionSlot[],
  movingId: number | null,
  requested: number,
): { position: number; rebalance: PositionSlot[] } {
  const sorted = slots
    .filter((slot) => slot.id !== movingId)
    .sort((a, b) => a.position - b.position || a.id - b.id);

  const requestedIsFree =
    Number.isFinite(requested) &&
    requested > 0 &&
    !sorted.some((slot) => tooClose(slot.position, requested));
  if (requestedIsFree) {
    return { position: requested, rebalance: [] };
  }

  const found = sorted.findIndex((slot) => slot.position > requested);
  const insertAt = found === -1 ? sorted.length : found;
  const sequence: Array<PositionSlot | null> = [...sorted];
  sequence.splice(insertAt, 0, null);

  const rebalance: PositionSlot[] = [];
  let position = POSITION_GAP;
  sequence.forEach((slot, index) => {
    const value = (index + 1) * POSITION_GAP;
    if (slot === null) {
      position = value;
      return;
    }
    rebalance.push({ id: slot.id, position: value });
  });
  return { position, rebalance };
}

/**
 * 末尾に置ける position を返す。末尾の加算が衝突する場合は全体を振り直す。
 * @param slots - ロック済みの既存アイテム
 * @returns 末尾の position と、必要な振り直し
 */
export function appendPosition(slots: PositionSlot[]): {
  position: number;
  rebalance: PositionSlot[];
} {
  const max = slots.reduce(
    (current, slot) => Math.max(current, slot.position),
    0,
  );
  return assignPosition(slots, null, max + POSITION_GAP);
}
