import { AccessibleIcon } from "@radix-ui/react-accessible-icon";
import { DirectionProvider } from "@radix-ui/react-direction";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button, Demo } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./utilities.css";

export default function UtilitiesBody() {
  return (
    <>
      <Demo title="Accessible Icon — icon button screen reader label">
        <Button className="dsv-icon-btn">
          <AccessibleIcon label="Delete item">
            <Icon name="trash" />
          </AccessibleIcon>
        </Button>
        <span className="dsv-muted dsv-utilities-note">visually same, screen reader says "Delete item"</span>
      </Demo>

      <Demo title="Visually Hidden — not visible, but in accessibility tree">
        <Button variant="outline">
          Save
          <VisuallyHidden> and return to editor</VisuallyHidden>
        </Button>
      </Demo>

      <Demo title="Direction Provider — RTL">
        <DirectionProvider dir="rtl">
          <div className="dsv-toolbar" dir="rtl">
            <Button size="sm" variant="ghost">
              قص
            </Button>
            <Button size="sm" variant="ghost">
              نسخ
            </Button>
            <span className="dsv-toolbar-sep" />
            <Button size="sm">حفظ</Button>
          </div>
        </DirectionProvider>
      </Demo>
    </>
  );
}
