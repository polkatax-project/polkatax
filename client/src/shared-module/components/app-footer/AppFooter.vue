<template>
  <div class="bg-grey-9 text-white q-pa-sm">
    <div class="row q-col-gutter-sm" style="margin: auto; max-width: 1024px">
      <div class="col-12 col-md-4 desktop-only">
        <div class="row items-center justify-center">
          <q-img
            src="/white.ico"
            style="border-radius: 50%; max-width: 2rem; height: 2rem"
            fit="scale-down"
          />
          <span class="q-ml-sm text-weight-bold">PolkaTax</span>
        </div>
        <div class="text-grey-4 q-mt-sm text-center">
          The easiest way to handle your Substrate chain tax reporting.
        </div>
      </div>
      <div class="col-6 col-md-4" v-for="(group, g) in footerLinks" :key="g">
        <div class="text-subtitle2 text-weight-bold q-mb-sm text-center">
          {{ group.title }}
        </div>
        <div
          v-for="link in group.links"
          :key="link"
          class="text-grey-4 text-center"
        >
          <router-link
            v-if="link?.routerLink"
            :to="link.routerLink"
            class="text-grey-4"
            >{{ link.label }}</router-link
          >
          <a v-if="link.link" :href="link.link" class="text-grey-4">{{
            link.label
          }}</a>
        </div>
      </div>
    </div>
    <div class="text-center text-grey-5">
      2025 PolkaTax. Crypto currency quotes are provided by
      <a href="https://coingecko.com" class="text-grey-4">coingecko.com</a>
    </div>
  </div>
</template>
<script setup lang="ts">
const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Tutorial & FAQ', routerLink: '/tutorial-faq', link: undefined },
    ],
  },
  {
    title: 'Resources',
    links: [
      {
        label: 'GitHub',
        routerLink: undefined,
        link: 'https://github.com/polkatax/polkatax',
      },
    ],
  },
];
</script>
