import type { RoomSession } from "~/types/canvas";
import { api } from "../../convex/_generated/api";

const SESSION_KEY_PREFIX = "monochrome-room-session:";

function clientKey(): string {
  if (process.server) return "server";
  const existing = localStorage.getItem("monochrome-client-key");
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem("monochrome-client-key", created);
  return created;
}

export function useRoom() {
  const createRoomMutation = useConvexMutation(api.rooms.createRoom);
  const joinRoomMutation = useConvexMutation(api.rooms.joinRoom);

  const storeSession = (session: RoomSession) => {
    if (process.server) return;
    localStorage.setItem(
      `${SESSION_KEY_PREFIX}${session.code}`,
      JSON.stringify(session),
    );
  };

  const loadSession = (code: string): RoomSession | null => {
    if (process.server) return null;
    const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${code}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RoomSession;
    } catch {
      return null;
    }
  };

  const clearSession = (code: string) => {
    if (process.server) return;
    localStorage.removeItem(`${SESSION_KEY_PREFIX}${code}`);
  };

  const createRoom = async (passcode: string, sessionName?: string) => {
    const result = await createRoomMutation.mutate({
      passcode,
      sessionName,
      clientKey: clientKey(),
    });
    const session: RoomSession = {
      roomId: result.roomId,
      code: result.code,
      sessionToken: result.sessionToken,
    };
    storeSession(session);
    return session;
  };

  const joinRoom = async (
    code: string,
    passcode: string,
    sessionName?: string,
  ) => {
    const result = await joinRoomMutation.mutate({
      code,
      passcode,
      sessionName,
      clientKey: clientKey(),
    });
    const session: RoomSession = {
      roomId: result.roomId,
      code: result.code,
      sessionToken: result.sessionToken,
    };
    storeSession(session);
    return session;
  };

  return {
    createRoom,
    joinRoom,
    loadSession,
    clearSession,
  };
}
