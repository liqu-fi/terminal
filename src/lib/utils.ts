import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Склейка классов с разрешением конфликтов Tailwind. Требуется каждым компонентом shadcn. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
