import {
  LayoutDashboard,
  ScanFace,
  Newspaper,
  ShieldCheck,
  History,
  Info,
  Film,
  Globe,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  to: "/" | "/deepfake" | "/video" | "/url" | "/fake-news" | "/verify" | "/history" | "/about";
  icon: LucideIcon;
  description: string;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard, description: "Overview of your workspace" },
  { title: "Deepfake Detection", to: "/deepfake", icon: ScanFace, description: "Images & videos" },
  { title: "Video Analysis", to: "/video", icon: Film, description: "Frame-by-frame video check" },
  { title: "URL Analysis", to: "/url", icon: Globe, description: "Website trust & phishing" },
  { title: "Fake News Detection", to: "/fake-news", icon: Newspaper, description: "Articles & claims" },
  { title: "Full Verification", to: "/verify", icon: ShieldCheck, description: "Combined media + text check" },
  { title: "History", to: "/history", icon: History, description: "Past verifications" },
  { title: "About", to: "/about", icon: Info, description: "Mission & methodology" },
];

export const SLOGAN = "Don't Believe Everything You See. Verify Before You Share.";
