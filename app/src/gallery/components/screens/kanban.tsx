import { Avat } from "./screenBits.tsx";
import "./screens.css";

const COLS: Record<string, string[]> = {
  "To do": ["Parser bug", "Update docs", "Add lint to CI"],
  "In progress": ["Preview tab", "Token bridge"],
  Done: ["Schema view", "409 guard", "Tests"],
};

const ASSIGNEES = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson"];

export default function KanbanBody() {
  let cardIndex = -1;
  return (
    <div className="dsv-kanban">
      {Object.entries(COLS).map(([col, cards]) => (
        <div key={col} className="dsv-kanban-col">
          <h4>
            {col} · {cards.length}
          </h4>
          {cards.map((c) => {
            cardIndex += 1;
            const assignee = ASSIGNEES[cardIndex % ASSIGNEES.length];
            return (
              <div key={c} className="dsv-kanban-card">
                {c}
                <div
                  className="dsv-inline"
                  style={{ marginTop: "var(--space-2)", justifyContent: "space-between" }}
                >
                  <span className="dsv-tag">{col === "Done" ? "done" : "dev"}</span>
                  <Avat name={assignee} size="xs" />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
