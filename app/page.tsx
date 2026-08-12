import { Shell } from "./components/Shell";
import { Dashboard } from "./components/Dashboard";

export default function HomePage() {
  return (
    <Shell
      title="Seguimiento"
      subtitle="Postulaciones de hoy, incompletas pendientes y la corrida en vivo."
    >
      <Dashboard />
    </Shell>
  );
}
