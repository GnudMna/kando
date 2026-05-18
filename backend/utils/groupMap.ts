/**
 * Map のキーに対応するバケットへ値を追加するユーティリティ。
 * バケットが存在しない場合は新規作成する。
 */
export function pushToGroupMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(value);
    return;
  }
  map.set(key, [value]);
}
