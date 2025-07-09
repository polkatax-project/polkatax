<template>
  <q-layout view="hHh lpR fFf">
    <AppHeader />
    <q-page-container>
      <q-page>
        <!-- TUTORIAL VIDEO -->
        <div style="max-width: 900px" class="q-mx-auto q-my-lg">
          <q-card
            flat
            bordered
            class="q-pa-md"
            style="
              border-radius: 16px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
            "
          >
            <div class="text-h6 q-mb-md">Getting Started Tutorial</div>
            <div
              class="video-wrapper"
              style="
                position: relative;
                background-color: white;
                padding-bottom: 56.25%;
                height: 0;
                overflow: hidden;
                border-radius: 12px;
              "
            >
              <iframe
                src="/tutorial.html"
                frameborder="0"
                allowfullscreen
                style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  border-radius: 12px;
                "
                title="PolkaTax Tutorial"
              ></iframe>
            </div>
          </q-card>

          <q-card
            flat
            bordered
            class="q-pa-md q-mt-md"
            style="
              border-radius: 16px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
            "
          >
            <div class="text-h6 q-mb-md">Koinly Import Tutorial</div>
            <div
              class="video-wrapper"
              style="
                position: relative;
                background-color: white;
                padding-bottom: 56.25%;
                height: 0;
                overflow: hidden;
                border-radius: 12px;
              "
            >
              <iframe
                src="/koinly-import-tutorial.html"
                frameborder="0"
                allowfullscreen
                style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  border-radius: 12px;
                "
                title="PolkaTax Tutorial"
              ></iframe>
            </div>
          </q-card>
        </div>
        <!-- FAQ Section -->
        <div class="q-mx-auto q-mb-xl q-my-xl content">
          <div class="text-h5 text-bold q-mb-md">
            Frequently Asked Questions
          </div>

          <q-expansion-item
            v-for="(item, index) in faqItems"
            :key="index"
            :label="item.question"
            group="faq"
            expand-icon="expand_more"
            :dense="false"
            class="faq-item q-mb-md"
            style="
              border-radius: 16px;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.07);
            "
          >
            <div class="faq-answer q-pa-md">{{ item.answer }}</div>
          </q-expansion-item>
        </div>
      </q-page>
    </q-page-container>
    <q-footer elevated>
      <AppFooter />
    </q-footer>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import AppFooter from '../shared-module/components/app-footer/AppFooter.vue';
import AppHeader from '../shared-module/components/app-header/AppHeader.vue';
import { useSharedStore } from '../shared-module/store/shared.store';

const supportedChains: Ref<string[]> = ref([]);

const store = useSharedStore();

const chainsSubscription = store.subscanChains$.subscribe((c) => {
  supportedChains.value = c.chains
    .map((x) => x.label)
    .sort((a, b) => (a.toUpperCase() > b.toUpperCase() ? 1 : -1));
});

onBeforeUnmount(() => {
  chainsSubscription.unsubscribe();
});

const faqItems = computed(() => [
  {
    question: 'How do I connect my wallet?',
    answer:
      'You don’t need to connect your wallet directly. Simply copy your wallet address from your wallet app or extension and paste it into the input field.',
  },
  {
    question: 'Which chains are supported?',
    answer:
      'We currently support the following chains: ' +
      supportedChains.value.join(', '),
  },
  {
    question: 'How do I export my tax reports?',
    answer:
      'In the "Wallets" overview, click on the wallet you wish to export data from. This will open the list of connected blockchains. Click the export icon next to a chain, then select the year you want to export in the dropdown menu.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'PolkaTax only accesses publicly available blockchain data and stores that information in a database. No personal or sensitive data is transmitted to external servers.',
  },
  {
    question: 'Can I use PolkaTax for multiple accounts?',
    answer:
      'Absolutely. You can connect multiple wallets and manage all their tax data seamlessly from a single dashboard.',
  },
  {
    question: 'What kind of data is shown/exported?',
    answer:
      'This application currently displays staking rewards from multiple Substrate-based chains for the previous year.',
  },
]);
</script>

<style scoped>
.faq-item .q-expansion-item__header {
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--q-primary);
  padding: 1.2rem 1.5rem;
  min-height: 60px;
}

.faq-item .q-expansion-item__content {
  background-color: #fafafa;
  border-radius: 0 0 16px 16px;
  padding: 1.5rem 2rem;
  color: #444;
  font-size: 1rem;
  line-height: 1.6;
  letter-spacing: 0.02em;
}

.q-page {
  background: white;
}

/* Keep video rounding smooth */
.video-wrapper iframe {
  border-radius: 12px;
}

.q-layout {
  font-family: 'Inter', sans-serif;
  margin: auto;
}

.section-title {
  font-weight: 700;
  font-size: 2rem;
  margin-bottom: 2rem;
}

.card-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  transition: transform 0.3s ease;
}

.q-btn {
  transition: transform 0.2s ease;
}
.q-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.q-card {
  transition: all 0.3s ease;
  border-radius: 20px;
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.6);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}
.q-card:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 15px 20px rgba(0, 0, 0, 0.15);
}
.q-card:hover .card-icon {
  transform: scale(1.1) rotate(2deg);
  transition: transform 0.3s ease;
}

.hover-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.hover-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
}

.cta {
  background: linear-gradient(to right, #ec4899, #8b5cf6);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

a {
  transition: color 0.3s;
}
a:hover {
  color: white !important;
}

.features-section {
  background: #f9fafb;
  padding: 3rem 1rem;
  border-radius: 24px;
}
</style>
