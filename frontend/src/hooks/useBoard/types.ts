import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Row } from "../../types";
import type { BoardIndexes } from "./boardIndexes";

/** ボード操作フック間で共有するコンテキスト。 */
export type BoardActionContext = {
  rowsRef: MutableRefObject<Row[]>;
  boardIndexesRef: MutableRefObject<BoardIndexes>;
  setRows: Dispatch<SetStateAction<Row[]>>;
  setOperationError: Dispatch<SetStateAction<string | null>>;
};
