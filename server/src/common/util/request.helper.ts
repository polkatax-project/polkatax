import { HttpError } from "../error/HttpError";

export class RequestHelper {
  defaultHeader = {};

  async req(
    url: string,
    method: string,
    body?: any,
    apiKey?: string,
  ): Promise<any> {
    const response = await this.handleError(
      fetch(url, {
        method: method,
        headers: { ...this.defaultHeader, "x-api-key": apiKey },
        body: body ? JSON.stringify(body) : undefined,
      }),
      body ? JSON.stringify(body) : "",
    );
    return response.json();
  }

  async handleError(fetchRequest: Promise<any>, body: string) {
    const response = await fetchRequest;
    if (!response.ok) {
      throw new HttpError(
        response.status,
        await response.text(),
        response.url + " - " + body,
      );
    }
    return response;
  }
}
