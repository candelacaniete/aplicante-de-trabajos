import { messageForEmptyApiResponse, messageForNonJsonApiResponse } from "@shared/api-client";

export async function readApiJson<T extends { error?: string }>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(messageForEmptyApiResponse(res.status));
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(messageForNonJsonApiResponse(res.status, text));
  }
}
