<script setup lang="ts">
import { api } from "../../../convex/_generated/api";
import InfiniteCanvas from "~/components/canvas/InfiniteCanvas.vue";
import RoomAccessGate from "~/components/ui/RoomAccessGate.vue";

const route = useRoute();
const code = computed(() => String(route.params.code || "").trim());
const room = useRoom();

const joining = ref(false);
const error = ref("");
const sessionToken = ref<string>("");
const roomId = ref<string>("");

const { data: roomMeta } = useConvexQuery(api.rooms.getRoomByCode, () => ({
  code: code.value,
}));
const { data: validation } = useConvexQuery(api.rooms.validateSession, () => ({
  code: code.value,
  sessionToken: sessionToken.value,
}));

onMounted(() => {
  const existing = room.loadSession(code.value);
  if (!existing) return;
  sessionToken.value = existing.sessionToken;
  roomId.value = existing.roomId;
});

watchEffect(() => {
  if (!sessionToken.value) return;
  if (!validation.value) return;
  if (validation.value.valid) return;
  room.clearSession(code.value);
  sessionToken.value = "";
  roomId.value = "";
});

const submitJoin = async (passcode: string, name?: string) => {
  joining.value = true;
  error.value = "";
  try {
    const session = await room.joinRoom(code.value, passcode, name);
    sessionToken.value = session.sessionToken;
    roomId.value = session.roomId;
  } catch (joinError) {
    error.value =
      joinError instanceof Error ? joinError.message : "Could not join room.";
  } finally {
    joining.value = false;
  }
};
</script>

<template>
  <div
    v-if="!roomMeta"
    class="min-h-screen bg-white text-black flex items-center justify-center"
  >
    <p class="text-sm">Loading room...</p>
  </div>
  <div
    v-else-if="!roomMeta._id"
    class="min-h-screen bg-white text-black flex items-center justify-center"
  >
    <p class="text-sm">Room not found.</p>
  </div>
  <RoomAccessGate
    v-else-if="!sessionToken || !roomId"
    :code="code"
    :loading="joining"
    :error="error"
    @submit="submitJoin"
  />
  <InfiniteCanvas
    v-else
    :room-id="roomId"
    :session-token="sessionToken"
    :code="code"
  />
</template>
