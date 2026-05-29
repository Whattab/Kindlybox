"use server";
import { redirect } from "next/navigation";

export async function redirectToQuiz(formData: FormData) {
  const recipient = formData.get("recipient") as string;
  const occasion = formData.get("occasion") as string;
  const budget = formData.get("budget") as string;
  
  // Build query string
  const params = new URLSearchParams();
  if (recipient) params.append("recipient", recipient);
  if (occasion) params.append("occasion", occasion);
  if (budget) params.append("budget", budget);
  
  redirect(`/quiz?${params.toString()}`);
}
