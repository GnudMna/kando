// アプリケーションのルートコンポーネント
// ヘッダーとメインコンテンツ（かんばんボード）を配置する
import { KanbanBoard } from './components/KanbanBoard';

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <h1 className="app-title">Kando</h1>
      </header>
      <main>
        <KanbanBoard />
      </main>
    </div>
  );
}

export default App;
