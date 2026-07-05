import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { fetchTask } from "../api/tasks";
import { queryKeys } from "../api/queryKeys";
import type { Task } from "../types";
import { taskNeedsDetailLoad } from "../utils/taskSummary";

/**
 * ビューポート内のサマリータスクについて、詳細を遅延取得する。
 * @param task - 表示中タスク
 * @param onLoaded - 詳細取得後に親 state へマージするコールバック
 * @returns 監視用 ref。カードルート要素に付与
 */
export function useLazyTaskDetails(task: Task, onLoaded: (task: Task) => void) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const needsLoad = taskNeedsDetailLoad(task);

  useEffect(() => {
    if (!needsLoad) return;
    const element = rootRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [needsLoad, task.id]);

  const { data } = useQuery({
    queryKey: queryKeys.tasks.detail(task.id),
    queryFn: () => fetchTask(task.id),
    enabled: needsLoad && isVisible,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data) {
      onLoaded(data);
    }
  }, [data, onLoaded]);

  return { rootRef, isLoadingDetails: needsLoad && isVisible && !data };
}
