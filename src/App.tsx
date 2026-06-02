import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";

export default function App() {
  return (
    <div className="p-6">
      <Card className="p-4 inline-flex gap-3">
        <Button variant="long">Long</Button>
        <Button variant="short">Short</Button>
        <Button variant="primary">Connect</Button>
      </Card>
    </div>
  );
}
