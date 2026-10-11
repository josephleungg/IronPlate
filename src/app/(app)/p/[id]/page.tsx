import { PostView } from "./view";

export const metadata = { title: "Post" };
export default async function PostPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  return <PostView id={id} />;
}
