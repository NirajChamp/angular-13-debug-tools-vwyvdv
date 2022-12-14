import { CommonModule } from '@angular/common';
import {
  HttpClientModule,
  HttpInterceptor,
  HttpResponse,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';
import { Injectable, NgModule, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { interval, of } from 'rxjs';
//import 'rxjs/add/operator/do';
import 'rxjs/operators';

import {
  distinctUntilChanged,
  filter,
  map,
  startWith,
  take,
  takeUntil,
  tap,
} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class HttpCacheInterceptor implements HttpInterceptor {
  intercept(request, next) {
    const key = 'saved-http-to-local';
    const enableAngularDebugKey =
      localStorage.getItem('enable-angular-debug') || 'false';
    const localHttp = JSON.parse(localStorage.getItem(key)) || {};
    const httpRequestKey =
      request.method +
      request.url +
      JSON.stringify(request.headers) +
      JSON.stringify(request.body) +
      JSON.stringify(request.params);
    if (
      enableAngularDebugKey === 'true' &&
      localHttp[httpRequestKey] &&
      request.method === 'GET'
    ) {
      return of(new HttpResponse(localHttp[httpRequestKey]));
    }
    return next.handle(request).pipe(
      tap({
        next: (event) => {
          if (event instanceof HttpResponse) {
            localHttp[httpRequestKey] = event;
            localStorage.setItem(key, JSON.stringify(localHttp));
          }
        },
        error: (error) => 'failed',
      })
    );
  }
}
@NgModule({
  imports: [CommonModule, HttpClientModule],
  declarations: [],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpCacheInterceptor,
      multi: true,
    },
  ],
})
export class HttpCacheInterceptorModule {}

@Injectable({
  providedIn: 'root',
})
export class DebugAngularService {
  navigationSubcription: any;
  constructor(private router: Router, private zone: NgZone) {
    this.storeAll();

    this.navigationSubcription = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd)
    );
    this.navigationSubcription.subscribe((val) => {
      // CHECK DOM HAS FULLY RENDERED. Thanks to https://dev.to/herodevs/route-fully-rendered-detection-in-angular-2nh4
      this.zone.runOutsideAngular(() => {
        // Check very regularly to see if the pending macrotasks have all cleared
        interval(10)
          .pipe(
            startWith(0), // So that we don't initially wait
            // To prevent a memory leak on two closely times route changes, take until the next nav start
            takeUntil(this.navigationSubcription),
            // Turn the interval number into the current state of the zone
            map(() => !this.zone.hasPendingMacrotasks),
            // Don't emit until the zone state actually flips from `false` to `true`
            distinctUntilChanged(),
            // Filter out unstable event. Only emit once the state is stable again
            filter((stateStable) => stateStable === true),
            take(1), // Complete the observable after it emits the first result
            tap((stateStable) => {
              // FULLY RENDERED!!!! // Add code here to report Fully Rendered
              const r = (router as any).rootContexts.contexts;
              const currentComponent =
                r && r.get('primary') && r.get('primary').outlet.component;
              this.removeNgContext(currentComponent);
              window['ngxDebugger'][currentComponent.constructor.name] =
                this.deepClone(currentComponent);
            })
          )
          .subscribe();
      });
    });
  }
  private storeAll() {
    if (!window['ngxDebugger']) window['ngxDebugger'] = {};
    window['ngxDebugger']['enableHttpCache'] = this.enableHttpCache;
    window['ngxDebugger']['clearHttpCache'] = this.clearHttpCache;
    window['ngxDebugger']['getHttpCache'] = this.getHttpCache;
    window['ngxDebugger']['saveComponent'] = this.saveComponent;
  }

  deepClone(obj, hash = new WeakMap()) {
    // Do not try to clone primitives or functions
    if (Object(obj) !== obj || obj instanceof Function) return obj;
    if (hash.has(obj)) return hash.get(obj); // Cyclic reference
    try {
      // Try to run constructor (without arguments, as we don't know them)
      var result = new obj.constructor();
    } catch (e) {
      // Constructor failed, create object without running the constructor
      result = Object.create(Object.getPrototypeOf(obj));
    }
    // Optional: support for some standard constructors (extend as desired)
    if (obj instanceof Map)
      Array.from(obj, ([key, val]) =>
        result.set(this.deepClone(key, hash), this.deepClone(val, hash))
      );
    else if (obj instanceof Set)
      Array.from(obj, (key) => result.add(this.deepClone(key, hash)));
    // Register in hash
    hash.set(obj, result);
    // Clone and assign enumerable own properties recursively
    return Object.assign(
      result,
      ...Object.keys(obj).map((key) => ({
        [key]: this.deepClone(obj[key], hash),
      }))
    );
  }

  public saveComponent(componentName, component) {
    this.removeNgContext(component);
    window['ngxDebugger'][componentName] = this.deepClone(component);
  }
  public enableHttpCache(enable?) {
    const enableAngularDebug = 'enable-angular-debug';

    if (enable === true) {
      localStorage.setItem(enableAngularDebug, 'true');
      console.log('enable Http Cache success');
    } else if (enable === false) {
      localStorage.setItem(enableAngularDebug, 'false');
      console.log('disable Http Cache success');
    } else {
      console.log(`HOW TO USE THIS FUNCTION:

      1. Enable: ngxDebugger.enableHttpCache(true);
      2. Disable: ngxDebugger.enableHttpCache(false);

      `);
    }
  }

  public clearHttpCache(url?) {
    const saveHttpKey = 'saved-http-to-local';

    const localHttp = JSON.parse(localStorage.getItem(saveHttpKey)) || {};
    if (url && url !== 'all') {
      delete localHttp[url];
      localStorage.setItem(saveHttpKey, JSON.stringify(localHttp));
      console.log('clearHttpCache success for: ', url);
    } else if (url === 'all') {
      localStorage.removeItem(saveHttpKey);
      console.log('clearHttpCache all urls success');
    } else {
      console.log(`HOW TO USE THIS FUNCTION:

1. call this function with a url as a parameter to clear the cache for that url
       example:
      ngxDebugger.clearHttpCache('http://localhost:4200/api/v1/users/1');

2. call this function with the string 'all' as a parameter to clear all cache
      example:
      ngxDebugger.clearHttpCache('all');

      `);
    }
  }

  public getHttpCache(url?) {
    const saveHttpKey = 'saved-http-to-local';

    const localHttp = JSON.parse(localStorage.getItem(saveHttpKey)) || {};
    if (url && url !== 'all') {
      const http = localHttp[url];
      console.log('getHttpCache success for: ', url);
      return console.log(http);
    } else if (url === 'all') {
      console.log('getHttpCache all urls success');
      return console.log(localHttp);
    } else {
      console.log(`HOW TO USE THIS FUNCTION:

1. call this function with a url as a parameter to get the cache for that url
      example:
      ngxDebugger.getHttpCache('http://localhost:4200/api/v1/users/1');

2. call this function without a parameter to get all cache
      example:
      ngxDebugger.getHttpCache('all');

      `);
    }
  }

  private removeNgContext(currentComponent: any, deep = 0) {
    Object.entries(currentComponent).forEach(([key, value]) => {
      if (key === '__ngContext__') {
        delete currentComponent[key];
      } else if (value && value['__ngContext__']) {
        delete currentComponent['__ngContext__'];
      } else if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        deep < 2
      ) {
        this.removeNgContext(value, deep + 1);
      }
    });
  }
}
