import { Router, Request, Response, NextFunction } from "express";
import type { BoardQuery } from "@kando/types/validation";
import { boardQuerySchema } from "@kando/types/validation";
import { validateQuery } from "../middleware/validate.js";
import {
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
router.get(
  "/",
  validateQuery(boardQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const board = await getBoard(
        req.userId!,
        res.locals.validatedQuery as BoardQuery,
      );
      res.json(board);
    } catch (err) {
      next(err);
    }
  },
);

/** ボード階層データ取得 API の Express ルーター。 */
export default router;
