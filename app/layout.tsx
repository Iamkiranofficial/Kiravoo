import type { Metadata } from "next";
import "./globals.css";
import AssistantChatAgent from "./components/AssistantChatAgent";
import CreatorNav from "./components/CreatorNav";
import NavigationBridge from "./components/NavigationBridge";

export const metadata: Metadata = {
  title: "KIRAVO — Create what you imagine",
  description: "An AI creative studio for turning ideas into cinematic video concepts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<AssistantChatAgent /><CreatorNav /><NavigationBridge /></body></html>;
}
