export const showMaxWalletsReachedNotif = ($q: any) => {
  $q.notify({
    message: 'You have reached the maximum number of wallets to sync.',
    position: 'center',
    timeout: Math.random() * 10000,
    actions: [
      {
        icon: 'close',
        'aria-label': 'Dismiss',
      },
    ],
  });
};
