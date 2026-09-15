import type { Metadata } from "next";
import "./globals.css";
import AssistantChat from "./components/AssistantChat";

export const metadata: Metadata = {
  title: "KIRAVO — Create what you imagine",
  description: "An AI creative studio for turning ideas into cinematic video concepts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<AssistantChat /></body></html>;
}
