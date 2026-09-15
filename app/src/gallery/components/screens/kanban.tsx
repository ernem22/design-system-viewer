import { Avat } from "./screenBits.tsx";
import "./screens.css";

const COLS: Record<string, string[]> = {
  "To do": ["Parser bug", "Update docs", "Add lint to CI"],
  "In progress": ["Preview tab", "Token bridge"],
  Done: ["Schema view", "409 guard", "Tests"],
};

export default function KanbanBody() {
  return (
    <div className="dsv-kanban">
      {Object.entries(COLS).map(([col, cards]) => (
        <div key={col} className="dsv-kanban-col">
          <h4>
            {col} · {cards.length}
          </h4>
          {cards.map((c) => (
            <div key={c} className="dsv-kanban-card">
              {c}
              <div
                className="dsv-inline"
                style={{ marginTop: "var(--space-2)", justifyContent: "space-between" }}
              >
                <span className="dsv-tag">{col === "Done" ? "done" : "dev"}</span>
                <Avat n={c.length + 5} size="xs" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
