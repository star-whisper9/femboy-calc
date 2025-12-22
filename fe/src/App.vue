<script setup lang="ts">
import { ref } from 'vue';

const name = ref('');
const loading = ref(false);
interface ScoreResponse {
  score: number;
  rank: string;
  tags: string[];
  analysis: string;
  match_character: string;
}

const result = ref<ScoreResponse | null>(null);
const error = ref('');

const submit = async () => {
  if (!name.value.trim()) return;
  if (name.value.length > 15) {
    error.value = '昵称长度不能超过15个字符';
    return;
  }

  const startedAt = Date.now();
  loading.value = true;
  error.value = '';
  result.value = null;

  try {
    const response = await fetch('/api/score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: name.value }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '请求失败');
    }

    const data = (await response.json()) as ScoreResponse;
    result.value = data;
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : '请求失败';
  } finally {
    const elapsed = Date.now() - startedAt;
    const remaining = 1000 - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    loading.value = false;
  }
};
</script>

<template>
  <div
    class="min-h-screen bg-[#FDF5FF] flex flex-col items-center justify-center p-4 font-sans text-gray-800"
  >
    <div class="text-center mb-8">
      <h1
        class="text-3xl md:text-4xl font-bold text-[#D980FA] mb-2 flex items-center justify-center gap-2 animate-breathe transition-transform duration-300 hover:scale-110 cursor-default"
      >
        <span>🌸</span>
        <span
          class="bg-gradient-to-r from-[#D980FA] to-[#FF69B4] bg-clip-text text-transparent"
        >
          年度男娘程度总结器
        </span>
        <span>🌸</span>
      </h1>
      <p class="text-gray-500">输入你的昵称，测测你的男娘指数吧！</p>
    </div>

    <div
      class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
    >
      <h2 class="text-xl font-bold mb-2">开始测试</h2>
      <p class="text-gray-500 text-sm mb-6">
        请输入你的昵称，我们将为你生成专属的男娘程度报告
      </p>

      <div class="space-y-4">
        <input
          v-model="name"
          type="text"
          placeholder="输入你的昵称..."
          maxlength="15"
          class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#D980FA]/50 transition-all text-center"
          @keyup.enter="submit"
        />

        <div v-if="error && !loading" class="text-red-500 text-sm">
          {{ error }}
        </div>

        <button
          @click="submit"
          :disabled="loading || !name.trim()"
          class="w-full bg-gradient-to-r from-[#E0AAFF] to-[#C77DFF] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span>{{ loading ? '分析中...' : '开始测试' }}</span>
          <span
            v-if="loading"
            class="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <div
      v-if="result && !loading"
      class="mt-8 bg-white rounded-2xl shadow-lg p-8 w-full max-w-md animate-fade-in"
    >
      <div class="text-center">
        <div class="text-5xl font-bold text-[#D980FA] mb-2">
          {{ result.score }}
        </div>
        <div class="text-xl font-bold text-gray-700 mb-4">
          {{ result.rank }}
        </div>

        <div class="flex flex-wrap gap-2 justify-center mb-6">
          <span
            v-for="tag in result.tags"
            :key="tag"
            class="bg-[#F3E5F5] text-[#9C27B0] px-3 py-1 rounded-full text-sm"
          >
            {{ tag }}
          </span>
        </div>

        <p class="text-gray-600 mb-4 text-left bg-gray-50 p-4 rounded-lg">
          {{ result.analysis }}
        </p>
      </div>
    </div>

    <div class="mt-8 text-gray-400 text-sm flex items-center gap-1">
      <span>💡</span>
      提示：相同的昵称会得到相同的结果哦
    </div>
  </div>
</template>

<style>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes breathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.15;
  }
}
.animate-fade-in {
  animation: fade-in 0.5s ease-out forwards;
}
.animate-breathe {
  animation: breathe 1.5s ease-in-out infinite;
}
</style>
