import { Observable, from, throwError,  } from 'rxjs';
import { shareReplay, catchError } from 'rxjs/operators';
import {firstValueFrom, of } from 'rxjs'

export class ResponseCache {
  private cache$: Record<string, { expiry: number, obs?: Observable<any> }> = {};

  constructor(private ttl: number = 3600 * 1000 * 24) {
  }

  private fetchData<T>(request: () => Promise<T>): Observable<T> {
    return from(request()).pipe(
      catchError(err => {
        // Don't cache errors except 404
        if (err.statusCode === 404) {
            return of(null)
        } else {
            this.cache$ = null;
            return throwError(() => err);
        }
      }),
      shareReplay(1)
    );
  }

  getData<T>(key: string, request: () => Promise<T>): Promise<any> {
    if (!this.cache$[key] || Date.now() > this.cache$[key].expiry) {
        this.cache$[key] = {
          expiry: Date.now() + this.ttl,
          obs: this.fetchData<T>(request)
        }
    }
    return firstValueFrom(this.cache$[key].obs);
  }
}
