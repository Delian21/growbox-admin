import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui convention: conditional + conflict-resolved class merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
