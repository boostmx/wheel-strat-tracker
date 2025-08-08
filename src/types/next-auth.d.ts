// src/types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      bio?: string;
      avatarUrl?: string;
      isAdmin?: boolean; // Optional, depending on your user model
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    bio?: string;
    avatarUrl?: string;
    isAdmin?: boolean;
  }
}
