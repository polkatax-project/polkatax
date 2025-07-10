import net from "net";

export async function waitForPortToBeFree(
  port: number,
  retries = 10,
  interval = 100,
) {
  for (let i = 0; i < retries; i++) {
    const isFree = await new Promise((resolve) => {
      const tester = net
        .createServer()
        .once("error", () => resolve(false))
        .once("listening", () => {
          tester.close();
          resolve(true);
        })
        .listen(port);
    });

    if (isFree) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Port ${port} is still in use after waiting`);
}

export async function waitForPortToBeOccupied(
  port: number,
  retries = 10,
  interval = 100,
) {
  for (let i = 0; i < retries; i++) {
    const isFree = await new Promise((resolve) => {
      const tester = net
        .createServer()
        .once("error", () => resolve(false))
        .once("listening", () => {
          tester.close();
          resolve(true);
        })
        .listen(port);
    });

    if (!isFree) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Port ${port} is still in not used after waiting`);
}
