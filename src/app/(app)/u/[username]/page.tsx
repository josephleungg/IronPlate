import { ProfileView } from "./view";

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  return <ProfileView username={username} />;
}
