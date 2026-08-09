import { redirect } from "next/navigation";
import NewPRForm from "./NewPRForm";

interface PageProps {
  searchParams: { service?: string };
}

export default function NewPRPage({ searchParams }: PageProps) {
  if (searchParams.service === "Movements") {
    redirect("/dashboard/movements/new");
  }

  return <NewPRForm initialService="Zambeel 360" />;
}
