// ログイン・ユーザー登録画面コンポーネント
import { useState, useId, useRef, useEffect } from "react";
import { LogIn, UserPlus } from "lucide-react";

type ScreenMode = "login" | "register";

/** `LoginScreen` コンポーネントの props。 */
interface LoginScreenProps {
  /** 初期モード: `"register"` を指定するとユーザー登録フォームで開始 */
  initialMode?: ScreenMode;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string) => Promise<void>;
  error: string | null;
  onClearError: () => void;
}

/**
 * ログイン／ユーザー登録画面を描画する。
 * initialMode="register" のときは登録フォームが表示され、モード切替も可能。
 * @param initialMode - 初期モード（デフォルト: `"login"`）
 * @param onLogin - ログインコールバック
 * @param onRegister - ユーザー登録コールバック
 * @param error - 表示するエラーメッセージ。なければ `null`
 * @param onClearError - エラーをクリアするコールバック
 * @returns ログイン画面の JSX 要素
 */
export function LoginScreen({
  initialMode = "login",
  onLogin,
  onRegister,
  error,
  onClearError,
}: LoginScreenProps) {
  const [mode, setMode] = useState<ScreenMode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const usernameInputId = useId();
  const passwordInputId = useId();
  const usernameRef = useRef<HTMLInputElement>(null);

  // マウント時またはモード切替時にユーザー名入力欄にフォーカスを当てる
  useEffect(() => {
    usernameRef.current?.focus();
  }, [mode]);

  /**
   * フォーム送信イベントを処理する。ログインまたは登録 API を呼び出す。
   * @param e - React のフォーム送信イベント
   * @returns 処理完了時に解決される Promise
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await onLogin(username, password);
      } else {
        await onRegister(username, password);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * フォームモードを切り替え、入力内容とエラーをリセットする。
   * @param newMode - 切り替え先モード
   * @returns なし
   */
  const switchMode = (newMode: ScreenMode) => {
    onClearError();
    setUsername("");
    setPassword("");
    setMode(newMode);
  };

  const isRegister = mode === "register";

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img
            src="/favicon.svg"
            alt=""
            className="app-logo login-logo"
            aria-hidden="true"
          />
          <h1 className="app-title login-title">Kando</h1>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-field">
            <label htmlFor={usernameInputId} className="modal-label">
              ユーザー名
            </label>
            <input
              ref={usernameRef}
              id={usernameInputId}
              type="text"
              value={username}
              onChange={(e) => {
                onClearError();
                setUsername(e.target.value);
              }}
              className="task-content-input login-input"
              placeholder="ユーザー名を入力"
              autoComplete={isRegister ? "username" : "username"}
              disabled={isSubmitting}
            />
          </div>

          <div className="login-field">
            <label htmlFor={passwordInputId} className="modal-label">
              パスワード
              {isRegister && <span className="login-hint">（12文字以上）</span>}
            </label>
            <input
              id={passwordInputId}
              type="password"
              value={password}
              onChange={(e) => {
                onClearError();
                setPassword(e.target.value);
              }}
              className="task-content-input login-input"
              placeholder="パスワードを入力"
              autoComplete={isRegister ? "new-password" : "current-password"}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={!username || !password || isSubmitting}
          >
            {isRegister ? (
              <UserPlus size={15} aria-hidden="true" />
            ) : (
              <LogIn size={15} aria-hidden="true" />
            )}
            {isSubmitting
              ? isRegister
                ? "登録中..."
                : "確認中..."
              : isRegister
                ? "アカウントを作成"
                : "ログイン"}
          </button>
        </form>

        <div className="login-switch">
          {isRegister ? (
            <span>
              既にアカウントをお持ちですか？{" "}
              <button
                type="button"
                className="login-switch-btn"
                onClick={() => switchMode("login")}
                disabled={isSubmitting}
              >
                ログイン
              </button>
            </span>
          ) : (
            <span>
              アカウントをお持ちでない方は{" "}
              <button
                type="button"
                className="login-switch-btn"
                onClick={() => switchMode("register")}
                disabled={isSubmitting}
              >
                新規登録
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
