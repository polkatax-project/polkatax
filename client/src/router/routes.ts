import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router';

type Breadcrumb = (route: RouteLocationNormalizedLoaded) => {
  label: string;
  route: string;
};

// Helper to build base wallet route path
const walletBasePath = (route: RouteLocationNormalizedLoaded) =>
  `/wallets/${route.params.wallet ?? ''}/${route.params.currency ?? ''}`;

const breadcrumbs: Record<string, Breadcrumb> = {
  wallets: () => ({ label: 'Wallets', route: '/wallets' }),

  blockchains: (route) => ({
    label: 'Connected blockchains',
    route: walletBasePath(route),
  }),

  taxableEvents: (route) => ({
    label: 'Taxable Events',
    route: `${walletBasePath(route)}/${route.params.blockchain ?? ''}`,
  }),
};

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('src/layouts/WelcomeAll.vue'),
  },
  {
    name: 'Tutorial & FAQ',
    path: '/tutorial-faq',
    component: () => import('src/layouts/TutorialFAQ.vue'),
  },
  {
    path: '/',
    component: () => import('src/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        redirect: 'wallets',
        meta: { breadcrumbs: [breadcrumbs.wallets] },
      },
      {
        name: 'Wallets',
        path: 'wallets',
        component: () =>
          import('src/wallets-module/components/WalletsDashboard.vue'),
        meta: { breadcrumbs: [breadcrumbs.wallets] },
      },
      {
        name: 'Connected Blockchains',
        path: 'wallets/:wallet/:currency',
        component: () =>
          import(
            'src/connected-blockchains-module/components/ConnectedBlockchainsList.vue'
          ),
        meta: {
          breadcrumbs: [breadcrumbs.wallets, breadcrumbs.blockchains],
          parent: () => '/wallets',
        },
      },
      {
        name: 'Taxable Events',
        path: 'wallets/:wallet/:currency/:blockchain',
        component: () =>
          import(
            'src/taxable-events-module/components/TaxableEventsTabView.vue'
          ),
        meta: {
          breadcrumbs: [
            breadcrumbs.wallets,
            breadcrumbs.blockchains,
            breadcrumbs.taxableEvents,
          ],
          parent: (route: RouteLocationNormalizedLoaded) =>
            walletBasePath(route),
        },
      },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () =>
      import('src/shared-module/components/error/ErrorNotFound.vue'),
  },
];

export default routes;
