import type { AxiosInstance } from "axios";
import type { AIChatSession, AIChatMessage } from "@/lib/types";
import { apiClient } from "../client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4006";

export class AIRepository {
  private readonly client: AxiosInstance;
  private readonly basePath = "/ai/chat";

  constructor(client: AxiosInstance = apiClient) {
    this.client = client;
  }

  async getSessions(): Promise<AIChatSession[]> {
    const response = await this.client.get<AIChatSession[]>(`${this.basePath}/sessions`);
    return response.data;
  }

  async getSession(sessionId: string): Promise<AIChatSession> {
    const response = await this.client.get<AIChatSession>(
      `${this.basePath}/sessions/${sessionId}`,
    );
    return response.data;
  }

  async createSession(productId?: string): Promise<AIChatSession> {
    const response = await this.client.post<AIChatSession>(
      `${this.basePath}/sessions`,
      { product_id: productId },
    );
    return response.data;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.delete(`${this.basePath}/sessions/${sessionId}`);
  }

  async getMessages(sessionId: string): Promise<AIChatMessage[]> {
    const response = await this.client.get<AIChatMessage[]>(
      `${this.basePath}/sessions/${sessionId}/messages`,
    );
    return response.data;
  }

  async sendMessage(
    sessionId: string,
    content: string,
    images?: string[],
  ): Promise<AIChatMessage> {
    const response = await this.client.post<AIChatMessage>(
      `${this.basePath}/sessions/${sessionId}/messages`,
      {
        content,
        role: "user",
        ...(images?.length ? { images } : {}),
      },
      { timeout: 120_000 },
    );
    return response.data;
  }

  async streamChat(
    sessionId: string,
    messages: { role: string; content: string }[],
    signal?: AbortSignal,
  ): Promise<Response> {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

    // Find the last user message (skip empty assistant placeholders)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user" && m.content);
    const response = await fetch(
      `${API_BASE_URL}/ai/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ session_id: sessionId, content: lastUserMessage?.content ?? "" }),
        signal,
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please wait a moment.");
      }
      throw new Error(`Request failed with status ${response.status}`);
    }

    if (!response.body) throw new Error("No response body");

    return response;
  }
}

export const aiRepository = new AIRepository();
