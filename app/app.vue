<script setup lang="ts">
import { ref } from "vue";
import { api } from "../convex/_generated/api";

const { data: tasks } = useConvexQuery(api.tasks.get);

const createTask = useConvexMutation(api.tasks.create);
const removeTask = useConvexMutation(api.tasks.remove);

const newTask = ref("");

const submit = async () => {
  if (!newTask.value.trim()) return;

  await createTask.mutate({
    text: newTask.value,
  });

  newTask.value = "";
};
</script>

<template>
  <div class="min-h-screen bg-[#FFF4EE] relative overflow-hidden">
    <!-- Dotted grid background -->
    <div
      class="absolute inset-0 pointer-events-none opacity-30"
      style="
        background-image: radial-gradient(#e6b8a2 1px, transparent 1px);
        background-size: 20px 20px;
      "
    ></div>

    <!-- Header -->
    <header class="relative z-10 px-6 py-5 border-b border-[#f0cdbb]">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <h1 class="text-2xl font-semibold text-[#5a2d1a]">Peach Tasks</h1>
        <span class="text-sm text-[#8a4b32]"> Shared • Live </span>
      </div>
    </header>

    <!-- Main -->
    <main class="relative z-10 max-w-4xl mx-auto px-6 py-10">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-[#5a2d1a]">Things to do</h2>
        <p class="text-[#8a4b32] mt-1">
          A simple shared space. No accounts. No friction.
        </p>
      </div>

      <!-- Create Task -->
      <div class="mb-6 flex gap-3">
        <input
          v-model="newTask"
          @keydown.enter="submit"
          placeholder="Add a task…"
          class="flex-1 rounded-xl border border-[#f0cdbb] px-4 py-3 bg-[#FFF4EE] text-[#5a2d1a] placeholder-[#b07a63] focus:outline-none focus:ring-2 focus:ring-[#d17c5a]"
        />

        <button
          @click="submit"
          class="px-5 rounded-xl bg-[#d17c5a] text-white font-medium hover:bg-[#b96547] transition"
        >
          Add
        </button>
      </div>

      <!-- Task List -->
      <div
        class="bg-[#FFE7DC] border border-[#f0cdbb] rounded-2xl shadow-sm p-6"
      >
        <ul class="space-y-3">
          <li
            v-for="task in tasks"
            :key="task._id"
            class="flex items-center justify-between bg-[#FFF4EE] rounded-xl px-4 py-3 border border-[#f0cdbb]"
          >
            <div class="flex items-center gap-3">
              <span class="w-2 h-2 rounded-full bg-[#d17c5a]"></span>

              <span class="text-[#5a2d1a]">
                {{ task.text }}
              </span>
            </div>

            <!-- Delete Button -->
            <button
              @click="removeTask.mutate({ id: task._id })"
              class="text-[#b96547] hover:text-[#8a4b32] text-sm"
            >
              Delete
            </button>
          </li>

          <!-- Empty State -->
          <li
            v-if="!tasks || tasks.length === 0"
            class="text-[#8a4b32] text-sm italic"
          >
            No tasks yet. Start adding.
          </li>
        </ul>
      </div>
    </main>

    <!-- Footer -->
    <footer class="relative z-10 text-center text-sm text-[#8a4b32] py-6">
      Built with Nuxt + Convex
    </footer>
  </div>
</template>
