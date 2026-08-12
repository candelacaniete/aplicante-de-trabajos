import { Shell } from "../components/Shell";
import { Wizard } from "../components/Wizard";

export default function SetupPage() {
  return (
    <Shell
      title="Cargar tus datos"
      subtitle="Esto reemplaza pegar la Parte 1 a mano. Una vez sola, y queda en archivos locales."
    >
      <Wizard />
    </Shell>
  );
}
