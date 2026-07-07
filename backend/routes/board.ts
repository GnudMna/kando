import { Router, Request, Response, NextFunction } from "express";
import {
  BoardQueryError,
  buildBoardHierarchy,
  filterBoardToNonEmptyTasks,
  getBoard,
} from "../services/boardService.js";

const router = Router();

export { buildBoardHierarchy, filterBoardToNonEmptyTasks };

/**
 * GET /api/board
 * ボード全体を取得し、行・カラム・タスクの階層構造で返す。
 * `detail=summary` 時は子要素を件数のみ返し、`q` 指定時はサーバー側検索を行う。
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const board = await getBoard(req.userId!, req.query);
    res.json(board);
  } catch (err) {
    if (err instanceof BoardQueryError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

/** ボード階層データ取得 API の Express ルーター。 */
export default router;
