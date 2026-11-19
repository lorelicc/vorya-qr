import { StatusPage } from "@/components/layout/StatusPage";
import { NotFound as NotFoundArt } from "@/components/illustrations";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <StatusPage
      title="Pagina non trovata"
      illustration={<NotFoundArt />}
      actions={<ButtonLink href="/">Torna alla home</ButtonLink>}
    >
      <p>La pagina che cerchi non esiste o è stata spostata.</p>
    </StatusPage>
  );
}
