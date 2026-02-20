<script setup lang="ts">
const room = useRoom();
const router = useRouter();

const createPasscode = ref("");
const joinCode = ref("");
const joinPasscode = ref("");
const name = ref("");
const creating = ref(false);
const joining = ref(false);
const errorMessage = ref("");

const createRoom = async () => {
  errorMessage.value = "";
  creating.value = true;
  try {
    const session = await room.createRoom(createPasscode.value, name.value || undefined);
    await router.push(`/room/${session.code}`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Could not create room.";
  } finally {
    creating.value = false;
  }
};

const joinRoom = async () => {
  errorMessage.value = "";
  joining.value = true;
  try {
    const session = await room.joinRoom(
      joinCode.value.trim(),
      joinPasscode.value,
      name.value || undefined,
    );
    await router.push(`/room/${session.code}`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Could not join room.";
  } finally {
    joining.value = false;
  }
};
</script>

<template>
  <main class="min-h-screen bg-white text-black relative overflow-hidden">
    <div
      class="absolute inset-0 pointer-events-none"
      style="background-image: radial-gradient(#d4d4d4 1px, transparent 1px); background-size: 20px 20px;"
    ></div>
    <div class="relative z-10 min-h-screen flex items-center justify-center px-4">
      <div class="w-full max-w-3xl grid md:grid-cols-2 gap-4">
        <section class="border border-zinc-300 bg-white p-6 shadow-sm">
          <h1 class="text-xl font-medium">Monochrome Canvas</h1>
          <p class="text-sm text-zinc-600 mt-2">
            Infinite monochrome whiteboard with real-time collaboration.
          </p>
          <div class="mt-5 space-y-3">
            <input
              v-model="name"
              placeholder="Display name (optional)"
              class="w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black"
            />
            <input
              v-model="createPasscode"
              maxlength="6"
              inputmode="numeric"
              placeholder="Create room passcode (6 digits)"
              class="w-full border border-zinc-300 px-3 py-2 text-sm tracking-[0.2em] outline-none focus:border-black"
            />
            <button
              class="w-full bg-black text-white py-2 text-sm disabled:opacity-70"
              :disabled="creating"
              @click="createRoom"
            >
              {{ creating ? "Creating..." : "Create Room" }}
            </button>
          </div>
        </section>

        <section class="border border-zinc-300 bg-white p-6 shadow-sm">
          <h2 class="text-xl font-medium">Join Room</h2>
          <p class="text-sm text-zinc-600 mt-2">
            Enter room code and passcode.
          </p>
          <div class="mt-5 space-y-3">
            <input
              v-model="joinCode"
              maxlength="6"
              inputmode="numeric"
              placeholder="Room code"
              class="w-full border border-zinc-300 px-3 py-2 text-sm tracking-[0.2em] outline-none focus:border-black"
            />
            <input
              v-model="joinPasscode"
              maxlength="6"
              inputmode="numeric"
              placeholder="Passcode"
              class="w-full border border-zinc-300 px-3 py-2 text-sm tracking-[0.2em] outline-none focus:border-black"
            />
            <button
              class="w-full border border-black py-2 text-sm hover:bg-zinc-100 disabled:opacity-70"
              :disabled="joining"
              @click="joinRoom"
            >
              {{ joining ? "Joining..." : "Join" }}
            </button>
          </div>
          <p v-if="errorMessage" class="mt-3 text-sm">{{ errorMessage }}</p>
        </section>
      </div>
    </div>
  </main>
</template>
