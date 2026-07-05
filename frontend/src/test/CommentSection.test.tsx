import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentSection } from "../components/CommentSection";
import type { LocalTaskComment } from "../types";

describe("CommentSection", () => {
  const onCommentsChange = vi.fn();

  const comments: LocalTaskComment[] = [
    {
      id: 1,
      task_id: 10,
      content: "既存コメント",
      created_at: "2026-01-01T12:00:00.000Z",
      position: 1000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("コメント一覧を表示する", () => {
    render(
      <CommentSection
        comments={comments}
        taskId={10}
        onCommentsChange={onCommentsChange}
      />,
    );

    expect(screen.getByText("既存コメント")).toBeInTheDocument();
  });

  it("新規コメントを追加できる", async () => {
    const user = userEvent.setup();
    render(
      <CommentSection comments={[]} taskId={10} onCommentsChange={onCommentsChange} />,
    );

    await user.click(screen.getByRole("button", { name: "コメントを追加" }));
    await user.type(screen.getByPlaceholderText("コメントを入力..."), "新しいコメント");
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(onCommentsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          task_id: 10,
          content: "新しいコメント",
        }),
      ]),
    );
  });

  it("URL をリンクとして表示する", () => {
    const linkedComments: LocalTaskComment[] = [
      {
        id: 2,
        task_id: 10,
        content: "参照 https://example.com/path",
        created_at: "2026-01-02T12:00:00.000Z",
        position: 2000,
      },
    ];

    render(
      <CommentSection
        comments={linkedComments}
        taskId={10}
        onCommentsChange={onCommentsChange}
      />,
    );

    const link = screen.getByRole("link", { name: "https://example.com/path" });
    expect(link).toHaveAttribute("href", "https://example.com/path");
  });
});
