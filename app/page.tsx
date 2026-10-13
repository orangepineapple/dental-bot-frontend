import { redirect } from "next/navigation";

export default function Home() {
  // The chat page sends logged-out visitors on to /login.
  redirect("/chat");
}
