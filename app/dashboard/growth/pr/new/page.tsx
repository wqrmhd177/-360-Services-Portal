import NewPRForm from "./NewPRForm";

interface PageProps {
  searchParams: { service?: string };
}

export default function NewPRPage({ searchParams }: PageProps) {
  const initialService =
    searchParams.service === "Movements" ? "Movements" : "Zambeel 360";

  return <NewPRForm initialService={initialService} />;
}
