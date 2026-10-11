import { WorkoutDetailView } from "./view";

export const metadata = { title: "Workout" };
export default async function WorkoutPage({ params }: PageProps<"/train/w/[id]">) {
  const { id } = await params;
  return <WorkoutDetailView id={id} />;
}
