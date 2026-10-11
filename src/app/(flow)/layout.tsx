import type { ReactNode } from "react";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">{children}</main>;
}
