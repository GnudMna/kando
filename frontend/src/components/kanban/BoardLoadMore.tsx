import { ChevronDown, Loader2 } from "lucide-react";

interface BoardLoadMoreProps {
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * 追加行読み込みボタンを描画する。
 */
export function BoardLoadMore({
  isLoadingMore,
  onLoadMore,
}: BoardLoadMoreProps) {
  return (
    <div className="board-load-more">
      <button
        type="button"
        className="btn board-load-more-btn"
        onClick={onLoadMore}
        disabled={isLoadingMore}
      >
        {isLoadingMore ? (
          <>
            <Loader2 size={16} className="icon-spin" />
            読み込み中…
          </>
        ) : (
          <>
            <ChevronDown size={16} />
            さらに読み込む
          </>
        )}
      </button>
    </div>
  );
}
